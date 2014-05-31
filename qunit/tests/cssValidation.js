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
      ['rachaelrayshow.com##div[style="margin: 5px auto 0 auto; padding: 0px; color: #999999; font-size: 10px; text-align: center;"]', true],
      ['||21sexturycash.com^$third-party', true],
      ['##.advert_back_300xXXX', true],
      ['mail.google.com##.aeF > .nH > .nH[role="main"] > .aKB', true],
      ['cpu-world.com##div[style="height: 90px; padding: 3px; text-align: center"]', true],
      ['@@||sascdn.com^*/jwplayer-plugin.swf?$object-subrequest', true],
      ['##[onclick^="window.open(\'http://adultfriendfinder.com/search/"]', true],
      ['fulldls.com###table_filter + .torrent_table', true],
      ['movie2k.tl###tablemoviesindex > tbody:first-child:last-child > tr:last-child', true],
      ['movie4k.to###tablemoviesindex:last-child > tbody:first-child:last-child > tr:last-child', true]
    ];

    for (var i = 0; i < tests.length; i++)
      equal(validFilter(tests[i][0]), tests[i][1], tests[i][0]);
  });

  test("Catches CSS Errors", function()
  {
    var tests = [
      ['##.box[', false],
      ['##.box[target="', false],
      ['##.box[target="foo\'', false],
      ['##.box[target=\'foo"', false],
      ['##.box[target="foo"', false],
      ['##:bogus', false],
      ['##.box {', false],
      ['##.box {target="foo"}', false],
    ];

    for (var i = 0; i < tests.length; i++)
      equal(validFilter(tests[i][0]), tests[i][1], tests[i][0]);
  });


})();
