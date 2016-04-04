/**
 * @fileoverview Implements mark extension for making text marker
 * @author Sungho Kim(sungho-kim@nhnent.com) FE Development Team/NHN Ent.
 */

'use strict';

var extManager = require('../../extManager'),
    MarkerList = require('./markerList'),
    MarkerManager = require('./markerManager'),
    WysiwygMarkerHelper = require('./wysiwygMarkerHelper'),
    ViewOnlyMarkerHelper = require('./viewOnlyMarkerHelper'),
    MarkdownMarkerHelper = require('./markdownMarkerHelper');

var util = tui.util;

var MARKER_UPDATE_DELAY = 100,
    FIND_CRLF_RX = /(\n)|(\r\n)|(\r)/g;

/**
 * Mark Extension
 * Define marker extension
 */
extManager.defineExtension('mark', function(editor) {
    var ml = new MarkerList(),
        mm = new MarkerManager(ml),
        wmh, mmh, vmh;

    editor.eventManager.addEventType('markerUpdated');

    if (editor.isViewOnly()) {
        vmh = new ViewOnlyMarkerHelper(editor.preview);
    } else {
        wmh = new WysiwygMarkerHelper(editor.getSquire());
        mmh = new MarkdownMarkerHelper(editor.getCodeMirror());
    }

    /**
     * getHelper
     * Get helper for current situation
     * @returns {object} helper
     */
    function getHelper() {
        var helper;

        if (editor.isViewOnly()) {
            helper = vmh;
        } else if (editor.isWysiwygMode()) {
            helper = wmh;
        } else {
            helper = mmh;
        }

        return helper;
    }

    $(window).resize(function() {
        var helper = getHelper();

        ml.getAll().forEach(function(marker) {
            helper.updateMarkerWithExtraInfo(marker);
        });

        editor.eventManager.emit('markerUpdated', ml.getAll());
    });

    editor.on('setValueAfter', function() {
        var helper = getHelper();
        mm.resetContent(helper.getTextContent());
    });

    /**
     * setValueWithMarkers
     * Set value with markers
     * @param {string} value markdown content
     * @param {object} markerDataCollection marker data that obtain with exportMarkers method
     * @returns {[object]} markers
     */
    editor.setValueWithMarkers = function(value, markerDataCollection) {
        var helper;

        ml.resetMarkers();

        markerDataCollection.forEach(function(markerData) {
            ml.addMarker(markerData.start, markerData.end, markerData.id);
        });

        editor.setValue(value);

        mm.resetContent(value.replace(FIND_CRLF_RX, ''));

        if (editor.isViewOnly() || editor.isWysiwygMode()) {
            helper = getHelper();
            mm.getUpdatedMarkersByContent(helper.getTextContent());
        } else {
            helper = mmh;
        }

        ml.getAll().forEach(function(marker) {
            helper.updateMarkerWithExtraInfo(marker);
        });

        editor.eventManager.emit('markerUpdated', ml.getAll());

        return ml.getAll();
    };

    /**
     * getMarker
     * Get markers that have given id
     * @param {string} id id of marker
     * @returns {object}
     */
    editor.getMarker = function(id) {
        return ml.getMarker(id);
    };

    /**
     * getMarkersAll
     * Get all markers
     * @returns {[object]}
     */
    editor.getMarkersAll = function() {
        return ml.getAll();
    };

    /**
     * removeMarker
     * Remove marker with given id
     * @param {string} id of marker that should be removed
     * @returns {marker} removed marker
     */
    editor.removeMarker = function(id) {
        return ml.removeMarker(id);
    };

    /**
     * getMarkersData
     * Get marker data to export so you can restore markers next time
     * @returns {object} markers data
     */
    editor.exportMarkers = function() {
        var markersData;

        if (editor.isViewOnly() || editor.isMarkdownMode()) {
            markersData = ml.getMarkersData();
        } else if (editor.isWysiwygMode()) {
            mm.getUpdatedMarkersByContent(editor.getValue().replace(FIND_CRLF_RX, ''));
            markersData = ml.getMarkersData();
            mm.getUpdatedMarkersByContent(wmh.getTextContent());
        }

        return markersData;
    };

    /**
     * selectMarker
     * Make selection with marker that have given id
     * @param {string} id id of marker
     */
    editor.selectMarker = function(id) {
        var helper = getHelper(),
            marker = editor.getMarker(id);

        if (marker) {
            helper.selectOffsetRange(marker.start, marker.end);
        }
    };

    /**
     * clearSelect
     * Clear selection
     */
    editor.clearSelect = function() {
        getHelper().clearSelect();
    };

    if (!editor.isViewOnly()) {
        editor.on('changeMode', function() {
            var helper = getHelper();

            if (!ml.getAll().length) {
                return;
            }

            mm.getUpdatedMarkersByContent(helper.getTextContent());

            ml.getAll().forEach(function(marker) {
                helper.updateMarkerWithExtraInfo(marker);
            });

            editor.eventManager.emit('markerUpdated', ml.getAll());
        });

        editor.on('change', util.debounce(function() {
            var textContent,
                helper = getHelper();

            textContent = helper.getTextContent();

            mm.getUpdatedMarkersByContent(textContent);

            ml.getAll().forEach(function(marker) {
                helper.updateMarkerWithExtraInfo(marker);
            });

            editor.eventManager.emit('markerUpdated', ml.getAll());
        }, MARKER_UPDATE_DELAY));

        /**
         * addMarker
         * Add Marker with given id
         * if you pass just id then it uses current selection for marker
         * or you can pass start and end offset for marker
         * @param {number|string} start start offset or id
         * @param {number} end end offset
         * @param {string} id id of marker
         * @returns {object} marker that have made
         */
        editor.addMarker = function(start, end, id) {
            var marker,
                helper = getHelper();

            if (!id) {
                id = start;
                marker = helper.getMarkerInfoOfCurrentSelection();
            } else {
                marker = {
                    start: start,
                    end: end
                };

                marker = helper.updateMarkerWithExtraInfo(marker);
            }

            if (marker) {
                marker.id = id;
                marker = ml.addMarker(marker);
                ml.sortWith('end');
                editor.eventManager.emit('markerUpdated', [marker]);
            }

            return marker;
        };
    }
});
