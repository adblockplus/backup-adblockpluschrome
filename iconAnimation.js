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

iconAnimation = {
  _icons: new TabMap(),
  _animatedTabs: new TabMap(),
  step: 0,

  update: function(severity)
  {
    if (severity == this._severity)
       return;

    if (!this._severity)
      this._start();

    this._severity = severity;
  },
  stop: function()
  {
    clearInterval(this._interval);

    delete this._interval;
    delete this._severity;

    this._animatedTabs.clear();
  },
  registerTab: function(tab, icon)
  {
    this._icons.set(tab, icon);

    if (this._animatedTabs.has(tab))
      this._updateIcon(tab);
  },
  _start: function()
  {
    this._interval = setInterval(function()
    {
      this._getVisibleTabs(function(tabs)
      {
        if (tabs.length === 0)
          return;

        for (var i = 0; i < tabs.length; i++)
          this._animatedTabs.set(tabs[i], null);

        var interval = setInterval(function()
        {
          this._step++;
          tabs.forEach(this._updateIcon.bind(this));

          if (this._step < 10)
            return;

          clearInterval(interval);
          setTimeout(function()
          {
            interval = setInterval(function()
            {
              this._step--;
              tabs.forEach(this._updateIcon.bind(this));

              if (this._step > 0)
                return;

              clearInterval(interval);
              this._animatedTabs.clear();
            }.bind(this), 100);
          }.bind(this), 1000);
        }.bind(this), 100);
      }.bind(this));
    }.bind(this), 15000);
  },
  _getVisibleTabs: function(callback)
  {
    ext.windows.getAll(function(windows)
    {
      var tabs = [];
      var visibleWindows = windows.length;
      var active = function(tab)
      {
        tabs.push(tab);

        if (tabs.length == visibleWindows)
          callback(tabs);
      };

      for (var i = 0; i < windows.length; i++)
      {
        if (!windows[i].visible)
        {
          if (--visibleWindows === 0)
            callback(tabs);

          continue;
        }

        windows[i].getActiveTab(active);
      }
    });
  },
  _updateIcon: function(tab)
  {
    var path = this._icons.get(tab);

    if (!path)
      return;

    if (this._step > 0)
    {
      var suffix = "-notification-" + this._severity;

      if (this._step < 10)
        suffix += "-" + this._step;

      path = path.replace(/(?=\..+$)/, suffix);
    }

    tab.pageAction.setIcon(path);
  }
};
