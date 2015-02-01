/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2015 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var SELECTOR_GROUP_SIZE = 20;

var typeMap = {
  "img": "IMAGE",
  "input": "IMAGE",
  "audio": "MEDIA",
  "video": "MEDIA",
  "frame": "SUBDOCUMENT",
  "iframe": "SUBDOCUMENT"
};

var fuckFuckAdBlock = document.createElement("script");
fuckFuckAdBlock.innerHTML = "Object.defineProperty(window, 'fuckAdBlock', { value: null, writable: false, configurable: false });";

function checkCollapse(element)
{
  var tag = element.localName;
  if (tag in typeMap)
  {
    // This element failed loading, did we block it?
    var url = element.src;
    if (!url || !/^https?:/i.test(url))
      return;

    ext.backgroundPage.sendMessage(
      {
        type: "should-collapse",
        url: url,
        mediatype: typeMap[tag]
      },

      function(response)
      {
        if (response && element.parentNode)
        {
          var property = "display";
          var value = "none";

          // <frame> cannot be removed, doing that will mess up the frameset
          if (tag == "frame")
          {
            property = "visibility";
            value = "hidden";
          }

          // <input type="image"> elements try to load their image again
          // when the "display" CSS property is set. So we have to check
          // that it isn't already collapsed to avoid an infinite recursion.
          if (element.style.getPropertyValue(property) != value ||
              element.style.getPropertyPriority(property) != "important")
            element.style.setProperty(property, value, "important");
        }
      }
    );
  }
}

function checkSitekey()
{
  var attr = document.documentElement.getAttribute("data-adblockkey");
  if (attr)
    ext.backgroundPage.sendMessage({type: "add-sitekey", token: attr});
}

function hasInlineURL(element, attribute)
{
  var value = element.getAttribute(attribute);
  return value == null || /^\s*(javascript:|about:|$)/i.test(value);
}

function isInlineFrame(element)
{
  switch (element.localName)
  {
    case "iframe":
      return hasInlineURL(element, "src") || element.hasAttribute("srcdoc");
    case "frame":
      return hasInlineURL(element, "src");
    case "object":
      return hasInlineURL(element, "data") && element.contentDocument;
    default:
      return false;
  }
}

function resolveURL(url)
{
  var a = document.createElement("a");
  a.href = url;
  return a.href;
}

function reinjectRulesWhenRemoved(document, style)
{
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  if (!MutationObserver)
    return;

  var observer = new MutationObserver(function(mutations)
  {
    var isStyleRemoved = false;
    for (var i = 0; i < mutations.length; i++)
    {
      if ([].indexOf.call(mutations[i].removedNodes, style) != -1)
      {
        isStyleRemoved = true;
        break;
      }
    }
    if (!isStyleRemoved)
      return;

    observer.disconnect();

    var n = document.styleSheets.length;
    if (n == 0)
      return;

    var stylesheet = document.styleSheets[n - 1];
    ext.backgroundPage.sendMessage(
      {type: "get-selectors"},

      function(selectors)
      {
        while (selectors.length > 0)
        {
          var selector = selectors.splice(0, SELECTOR_GROUP_SIZE).join(", ");

          // Using non-standard addRule() here. This is the only way
          // to add rules at the end of a cross-origin stylesheet
          // because we don't know how many rules are already in there
          stylesheet.addRule(selector, "display: none !important;");
        }
      }
    );
  });

  observer.observe(style.parentNode, {childList: true});
}

function convertSelectorsForShadowDOM(selectors)
{
  var result = [];
  var prefix = "::content ";

  for (var i = 0; i < selectors.length; i++)
  {
    var selector = selectors[i];
    var start = 0;
    var sep = "";

    for (var j = 0; j < selector.length; j++)
    {
      var chr = selector[j];
      if (chr == "\\")
        j++;
      else if (chr == sep)
        sep = "";
      else if (chr == '"' || chr == "'")
        sep = chr;
      else if (chr == "," && sep == "")
      {
        result.push(prefix + selector.substring(start, j));
        start = j + 1;
      }
    }

    result.push(prefix + selector.substring(start));
  }

  return result;
}

function init(document)
{
  // Use Shadow DOM if available to don't mess with web pages that rely on
  // the order of their own <style> tags (#309).
  //
  // However, creating a shadow root breaks running CSS transitions. So we
  // have to create the shadow root before transistions might start (#452).
  //
  // Also, we can't use shadow DOM on Google Docs, since it breaks printing
  // there (#1770).
  var shadow = null;
  if ("createShadowRoot" in document.documentElement && document.domain != "docs.google.com")
  {
    shadow = document.documentElement.createShadowRoot();
    shadow.appendChild(document.createElement("shadow"));
  }

  // Sets the currently used CSS rules for elemhide filters
  var setElemhideCSSRules = function(selectors)
  {
    if (selectors.length == 0)
      return;

    var style = document.createElement("style");
    style.setAttribute("type", "text/css");

    if (shadow)
    {
      shadow.appendChild(style);
      shadow.appendChild(fuckFuckAdBlock);
      selectors = convertSelectorsForShadowDOM(selectors);
    }
    else
    {
      // Try to insert the style into the <head> tag, inserting directly under the
      // document root breaks dev tools functionality:
      // http://code.google.com/p/chromium/issues/detail?id=178109
      (document.head || document.documentElement).appendChild(style);
      (document.head || document.documentElement).appendChild(fuckFuckAdBlock);
    }

    var setRules = function()
    {
      // The sheet property might not exist yet if the
      // <style> element was created for a sub frame
      if (!style.sheet)
      {
        setTimeout(setRules, 0);
        return;
      }

      // WebKit apparently chokes when the selector list in a CSS rule is huge.
      // So we split the elemhide selectors into groups.
      for (var i = 0; selectors.length > 0; i++)
      {
        var selector = selectors.splice(0, SELECTOR_GROUP_SIZE).join(", ");
        style.sheet.insertRule(selector + " { display: none !important; }", i);
      }
    };

    setRules();
    reinjectRulesWhenRemoved(document, style);
  };

  document.addEventListener("error", function(event)
  {
    checkCollapse(event.target);
  }, true);

  document.addEventListener("load", function(event)
  {
    var element = event.target;

    if (/^i?frame$/.test(element.localName))
      checkCollapse(element);

    // prior to Chrome 37, content scripts cannot run on about:blank,
    // about:srcdoc and javascript: URLs. Moreover, as of Chrome 40
    // "load" and "error" events aren't dispatched there. So we have
    // to apply element hiding and collapsing from the parent frame.
    if (/\bChrome\//.test(navigator.userAgent) && isInlineFrame(element))
    {
      init(element.contentDocument);

      for (var tagName in typeMap)
        Array.prototype.forEach.call(element.contentDocument.getElementsByTagName(tagName), checkCollapse);
    }
  }, true);

  ext.backgroundPage.sendMessage({type: "get-selectors"}, setElemhideCSSRules);
}

if (document instanceof HTMLDocument)
{
  checkSitekey();
  init(document);
}
