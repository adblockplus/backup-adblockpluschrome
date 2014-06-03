/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2014 Eyeo GmbH
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
  module("CSS Validation");

  test("Permits entries from easy list", function()
  {
    var tests = [
      'rachaelrayshow.com##div[style="margin: 5px auto 0 auto; padding: 0px; color: #999999; font-size: 10px; text-align: center;"]',
      '||21sexturycash.com^$third-party',
      '##.advert_back_300xXXX',
      'mail.google.com##.aeF > .nH > .nH[role="main"] > .aKB',
      'cpu-world.com##div[style="height: 90px; padding: 3px; text-align: center"]',
      '@@||sascdn.com^*/jwplayer-plugin.swf?$object-subrequest',
      '##[onclick^="window.open(\'http://adultfriendfinder.com/search/"]',
      'fulldls.com###table_filter + .torrent_table',
      'movie2k.tl###tablemoviesindex > tbody:first-child:last-child > tr:last-child',
      'movie4k.to###tablemoviesindex:last-child > tbody:first-child:last-child > tr:last-child'
    ];

    for (var i = 0; i < tests.length; i++)
      equal(validFilter(tests[i]), true, tests[i]);
  });

  test("Catches CSS Errors", function()
  {
    var tests = [
      '##.box[',
      '##.box[target="',
      '##.box[target="foo\'',
      '##.box[target=\'foo"',
      '##.box[target="foo"',
      '##:bogus',
      '##.box {',
      '##.box {target="foo"}',
    ];

    for (var i = 0; i < tests.length; i++)
      equal(validFilter(tests[i]), false, tests[i]);
  });


})();
