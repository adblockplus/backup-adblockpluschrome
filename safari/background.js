/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
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

(function()
{
  /* Tabs */

  var TabEventTarget = function()
  {
    WrappedEventTarget.apply(this, arguments);
  };
  TabEventTarget.prototype = {
    __proto__: WrappedEventTarget.prototype,
    _wrapListener: function(listener)
    {
      return function(event)
      {
        if (event.target instanceof SafariBrowserTab)
          listener(new Tab(event.target));
      };
    }
  };

  var LoadingTabEventTarget = function(target)
  {
    WrappedEventTarget.call(this, target, "message", false);
  };
  LoadingTabEventTarget.prototype = {
    __proto__: WrappedEventTarget.prototype,
    _wrapListener: function(listener)
    {
      return function (event)
      {
        if (event.name == "loading" && event.message == event.target.url)
          listener(new Tab(event.target));
      };
    }
  };

  Tab = function(tab)
  {
    this._tab = tab;

    this._eventTarget = tab;
    this._messageDispatcher = tab.page;

    this.onLoading = new LoadingTabEventTarget(tab);
    this.onCompleted = new TabEventTarget(tab, "navigate", false);
    this.onActivated = new TabEventTarget(tab, "activate", false);
    this.onRemoved = new TabEventTarget(tab, "close", false);
  };
  Tab.prototype = {
    get url()
    {
      return this._tab.url;
    },
    close: function()
    {
      this._tab.close();
    },
    activate: function()
    {
      this._tab.activate();
    },
    sendMessage: sendMessage,
    pageAction: {
      // there are no page actions in safari, so we use toolbar items instead
      setIcon: function(path)
      {
        safari.extension.toolbarItems[0].image = safari.extension.baseURI + path;
      },
      setTitle: function(title)
      {
        safari.extension.toolbarItems[0].toolTip = title;
      },

      // toolbar items in safari can"t get hidden
      hide: function() {},
      show: function() {}
    }
  };

  TabMap = function()
  {
    this._tabs = [];
    this._values = [];

    this._onClosed = this._onClosed.bind(this);
  };
  TabMap.prototype =
  {
    get: function(tab) {
      var idx;

      if (!tab || (idx = this._tabs.indexOf(tab._tab)) == -1)
        return null;

      return this._values[idx];
    },
    set: function(tab, value)
    {
      var idx = this._tabs.indexOf(tab._tab);

      if (idx != -1)
        this._values[idx] = value;
      else
      {
        this._tabs.push(tab._tab);
        this._values.push(value);

        tab._tab.addEventListener("close", this._onClosed, false);
      }
    },
    has: function(tab)
    {
      return this._tabs.indexOf(tab._tab) != -1;
    },
    clear: function()
    {
      while (this._tabs.length > 0)
        this._delete(this._tabs[0]);
    },
    _delete: function(tab)
    {
      var idx = this._tabs.indexOf(tab);

      if (idx != -1)
      {
        this._tabs.splice(idx, 1);
        this._values.splice(idx, 1);

        tab.removeEventListener("close", this._onClosed, false);
      }
    },
    _onClosed: function(event)
    {
      this._delete(event.target);
    }
  };
  TabMap.prototype["delete"] = function(tab)
  {
    this._delete(tab._tab);
  };


  /* Windows */

  Window = function(win)
  {
    this._win = win;
  };
  Window.prototype = {
    get visible()
    {
      return this._win.visible;
    },
    getAllTabs: function(callback)
    {
      callback(this._win.tabs.map(function(tab) { return new Tab(tab); }));
    },
    getActiveTab: function(callback)
    {
      callback(new Tab(this._win.activeTab));
    },
    openTab: function(url, callback)
    {
      var tab = this._win.openTab();
      tab.url = url;

      if (callback)
        callback(new Tab(tab));
    }
  };

  if (safari.extension.globalPage.contentWindow == window)
  {
    /* Background page proxy */

    var proxy = {
      tabs: [],
      objects: [],

      registerObject: function(obj, objects)
      {
        var objectId = objects.indexOf(obj);

        if (objectId == -1)
          objectId = objects.push(obj) - 1;

        return objectId;
      },
      serializeSequence: function(sequence, objects, memo)
      {
        if (!memo)
          memo = {specs: [], arrays: []};

        var items = [];
        for (var i = 0; i < sequence.length; i++)
          items.push(this.serialize(sequence[i], objects, memo));

        return items;
      },
      serialize: function(obj, objects, memo)
      {
        if (typeof obj == "object" && obj !== null || typeof obj == "function")
        {
          if (obj.constructor == Array)
          {
            if (!memo)
              memo = {specs: [], arrays: []};

            var idx = memo.arrays.indexOf(obj);
            if (idx != -1)
              return memo.specs[idx];

            var spec = {type: "array"};
            memo.specs.push(spec);
            memo.arrays.push(obj);

            spec.items = this.serializeSequence(obj, objects, memo);
            return spec;
          }

          if (obj.constructor != Date && obj.constructor != RegExp)
            return {type: "object", objectId: this.registerObject(obj, objects)};
        }

        return {type: "value", value: obj};
      },
      createCallback: function(callbackId, tab)
      {
        var proxy = this;

        return function()
        {
          var idx = proxy.tabs.indexOf(tab);

          if (idx != -1) {
            var objects = proxy.objects[idx];

            tab.page.dispatchMessage("proxyCallback",
            {
              callbackId: callbackId,
              contextId: proxy.registerObject(this, objects),
              args: proxy.serializeSequence(arguments, objects)
            });
          }
        };
      },
      deserialize: function(spec, objects, tab, memo)
      {
        switch (spec.type)
        {
          case "value":
            return spec.value;
          case "hosted":
            return objects[spec.objectId];
          case "callback":
            return this.createCallback(spec.callbackId, tab);
          case "object":
          case "array":
            if (!memo)
              memo = {specs: [], objects: []};

            var idx = memo.specs.indexOf(spec);
            if (idx != -1)
              return memo.objects[idx];

            var obj;
            if (spec.type == "array")
              obj = [];
            else
              obj = {};

            memo.specs.push(spec);
            memo.objects.push(obj);

            if (spec.type == "array")
              for (var i = 0; i < spec.items.length; i++)
                obj.push(this.deserialize(spec.items[i], objects, tab, memo));
            else
              for (var k in spec.properties)
                if(spec.properties.hasOwnProperty(k))
                  obj[k] = this.deserialize(spec.properties[k], objects, tab, memo);

            return obj;
        }
      },
      createObjectCache: function(tab)
      {
        var objects = [window];

        this.tabs.push(tab);
        this.objects.push(objects);

        tab.addEventListener("close", function()
        {
          var idx = this.tabs.indexOf(tab);

          if (idx != -1)
          {
            this.tabs.splice(idx, 1);
            this.objects.splice(idx, 1);
          }
        }.bind(this));

        return objects;
      },
      getObjectCache: function(tab)
      {
        var idx = this.tabs.indexOf(tab);
        var objects;

        if (idx != -1)
          objects = this.objects[idx];
        else
          objects = this.objects[idx] = this.createObjectCache(tab);

        return objects;
      },
      fail: function(error)
      {
        if (error instanceof Error)
          error = error.message;
        return {succeed: false, error: error};
      },
      _handleMessage: function(message, tab)
      {
        var objects = this.getObjectCache(tab);

        switch (message.type)
        {
          case "getProperty":
            var obj = objects[message.objectId];

            try
            {
              var value = obj[message.property];
            }
            catch (e)
            {
              return this.fail(e);
            }

            return {succeed: true, result: this.serialize(value, objects)};
          case "setProperty":
            var obj = objects[message.objectId];
            var value = this.deserialize(message.value, objects, tab);

            try
            {
              obj[message.property] = value;
            }
            catch (e)
            {
              return this.fail(e);
            }

            return {succeed: true};
          case "callFunction":
            var func = objects[message.functionId];
            var context = objects[message.contextId];

            var args = [];
            for (var i = 0; i < message.args.length; i++)
              args.push(this.deserialize(message.args[i], objects, tab));

            try
            {
              var result = func.apply(context, args);
            }
            catch (e)
            {
              return this.fail(e);
            }

            return {succeed: true, result: this.serialize(result, objects)};
          case "inspectObject":
            var obj = objects[message.objectId];
            var objectInfo = {properties: {}, isFunction: typeof obj == "function"};

            Object.getOwnPropertyNames(obj).forEach(function(prop)
            {
              objectInfo.properties[prop] = {
                enumerable: Object.prototype.propertyIsEnumerable.call(obj, prop)
              };
            });

            if (obj.__proto__)
              objectInfo.prototypeId = this.registerObject(obj.__proto__, objects);

            if (obj == Object.prototype)
              objectInfo.prototypeOf = "Object";
            if (obj == Function.prototype)
              objectInfo.prototypeOf = "Function";

            return objectInfo;
        }
      }
    };


    /* Web request blocking */

    ext.webRequest = {
      onBeforeRequest: {
        _listeners: [],
        _urlPatterns: [],

        _handleMessage: function(message, tab)
        {
          tab = new Tab(tab);

          for (var i = 0; i < this._listeners.length; i++)
          {
            var regex = this._urlPatterns[i];

            if ((!regex || regex.test(message.url)) && this._listeners[i](message.url, message.type, tab, 0, -1) === false)
              return false;
          }

          return true;
        },
        addListener: function(listener, urls)
        {
          var regex;

          if (urls)
            regex = new RegExp("^(?:" + urls.map(function(url)
            {
              return url.split("*").map(function(s)
              {
                return s.replace(/([.?+^$[\]\\(){}|-])/g, "\\$1");
              }).join(".*");
            }).join("|") + ")($|[?#])");

          this._listeners.push(listener);
          this._urlPatterns.push(regex);
        },
        removeListener: function(listener)
        {
          var idx = this._listeners.indexOf(listener);

          if (idx != -1)
          {
            this._listeners.splice(idx, 1);
            this._urlPatterns.splice(idx, 1);
          }
        }
      },
      handlerBehaviorChanged: function() {}
    };


    /* Synchronous messaging */

    safari.application.addEventListener("message", function(event)
    {
      if (event.name == "canLoad")
      {
        var handler;

        switch (event.message.type)
        {
          case "proxy":
            handler = proxy;
            break;
          case "webRequest":
            handler = ext.webRequest.onBeforeRequest;
            break;
        }

        event.message = handler._handleMessage(event.message.payload, event.target);
      }
    }, true);
  }


  /* API */

  ext.windows = {
    getAll: function(callback)
    {
      callback(safari.application.browserWindows.map(function(win)
      {
        return new Window(win);
      }));
    },
    getLastFocused: function(callback)
    {
      callback(new Window(safari.application.activeBrowserWindow));
    }
  };

  ext.tabs = {
    onLoading: new LoadingTabEventTarget(safari.application),
    onCompleted: new TabEventTarget(safari.application, "navigate", true),
    onActivated: new TabEventTarget(safari.application, "activate", true),
    onRemoved: new TabEventTarget(safari.application, "close", true)
  };

  ext.backgroundPage = {
    getWindow: function()
    {
      return safari.extension.globalPage.contentWindow;
    }
  };

  ext.onMessage = new MessageEventTarget(safari.application);


  // Safari will load the bubble once, and then show it everytime the icon is
  // clicked. While Chrome loads it everytime you click the icon. So in order to
  // force the same behavior in Safari, we are going to reload the page of the
  // bubble everytime it is shown.
  if (safari.extension.globalPage.contentWindow != window)
    safari.application.addEventListener("popover", function()
    {
      document.documentElement.style.display = "none";
      document.location.reload();
    }, true);
})();
