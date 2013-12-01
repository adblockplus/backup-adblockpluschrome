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

//
// The values are hardcoded for now.
//

let defaults = {
  __proto__: null,
  enabled: true,
  data_directory: "",
  patternsbackups: 5,
  patternsbackupinterval: 24,
  savestats: false,
  privateBrowsing: false,
  subscriptions_fallbackerrors: 5,
  subscriptions_fallbackurl: "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&channelStatus=%CHANNELSTATUS%&responseStatus=%RESPONSESTATUS%",
  subscriptions_autoupdate: true,
  subscriptions_exceptionsurl: "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
  documentation_link: "https://adblockplus.org/redirect?link=%LINK%&lang=%LANG%",
  notificationdata: {},
  notificationurl: "https://notification.adblockplus.org/notification.json",
  stats_total: {}
};

let listeners = [];

function defineProperty(key)
{
  let value = null;
  Prefs.__defineGetter__(key, function()
  {
    if (value === null)
    {
      if (key in localStorage)
      {
        try
        {
          value = JSON.parse(localStorage[key]);
        }
        catch(e)
        {
          Cu.reportError(e);
        }
      }

      if (value === null)
        value = JSON.parse(JSON.stringify(defaults[key]));
    }
    return value;
  });
  Prefs.__defineSetter__(key, function(newValue)
  {
    if (typeof newValue != typeof defaults[key])
      throw new Error("Attempt to change preference type");

    let stringified = JSON.stringify(newValue);
    if (stringified != JSON.stringify(defaults[key]))
      localStorage[key] = stringified;
    else
      delete localStorage[key];

    value = newValue;

    for each (let listener in listeners)
      if (listeners.hasOwnProperty(listener))
        listener(key);

    return value;
  });
}


let Prefs = exports.Prefs = {
  addListener: function(listener)
  {
    if (listeners.indexOf(listener) < 0)
      listeners.push(listener);
  },

  removeListener: function(listener)
  {
    let index = listeners.indexOf(listener);
    if (index >= 0)
      listeners.splice(index, 1);
  },
};

for (let key in defaults)
  if (defaults.hasOwnProperty(key))
    defineProperty(key);
