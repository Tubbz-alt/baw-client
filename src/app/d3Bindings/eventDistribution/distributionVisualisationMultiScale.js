/**
 * Created by Anthony.
 *
 * Intended to show the visualisation chosen by the other event distribution controls
 * A large visual surface of SVG elements, controlled by d3
 * It shows a series of tiles
 *
 */
angular
    .module("bawApp.d3.eventDistribution.distributionVisualisationMultiScale", [])
    .service(
        "DistributionVisualisationMultiScale",
        [
            "$location",
            "$rootScope",
            "d3",
            "roundDate",
            "TimeAxis",
            "distributionCommon",
            "distributionTilingFunctions",
            function ($location, $rootScope, d3, roundDate, TimeAxis, common, TilingFunctions) {
                return function DistributionVisualisation(target, data, dataFunctions, uniqueId) {
                    // variables
                    var self = this,
                        container = d3.select(target),
                        svg = container.select(".imageTrack svg"),
                    //metaTrack = container.select(".metaTrack"),
                        main = container.select(".imageTrack .main"),
                        tilesBackground = main.select(".tilesBackground"),
                        datasetBoundsRect = main.select(".datasetBounds"),
                        tilesGroup = main.select(".tiles"),
                        focusGroup = main.select(".focusGroup"),
                        focusTextGroup = focusGroup.select(".focusTextGroup"),
                        focusLine = focusGroup.select(".focusLine"),
                        focusStem = focusGroup.select(".focusStem"),
                        focusAnchor = focusGroup.select(".focusAnchor"),
                        focusText = focusGroup.select(".focusText"),

                        tilesClipRect,

                        tileWidthPixels = 180,
                        tileCount = 0,
                    // default value, overridden almost straight away
                        tilesHeightPixels = 256,
                    // default value, overridden almost straight away
                        tilesTotalWidthPixels = 1440,


                        clipId = "distributionVisualizationMultiScale_" + uniqueId,
                        xScale = d3.time.scale(),
                        yScale = d3.scale.linear(),
                        /**
                         *  used to map actual zoom scale values to tiles of the appropriate resolution
                         */
                        resolutionScale = d3.scale.threshold(),
                        xAxis,
                        xAxisHeight = 30,
                        yAxis,
                        yAxisGroup,
                        yAxisWidth = 52,
                        margin = {
                            top: 23,
                            right: 0,
                            left: 68 + yAxisWidth,
                            bottom: 0 + xAxisHeight
                        },

                        visibleExtent = [],
                        visibleTiles = [],
                        tilingFunctions,
                    /*
                     * WeakMap<item, Map<resolution, tiles>>
                     */
                        tileCache = new WeakMap();

                    const timeFormatter = d3.time.format("%H:%M:%S");

                    // exports
                    self.items = [];
                    self.visualizationYMax = 11025;
                    self.visualizationTileHeight = 512;
                    self.visibleDuration = null;
                    self.middle = null;
                    self.category = null;
                    self.updateData = updateData;
                    self.updateMiddle = updateMiddle;
                    self.tileSizeSeconds = null;
                    // seconds per pixel
                    self.resolution = null;
                    self.currentZoomValue = 1;
                    self.availableResolutions = [];

                    // init
                    create();

                    /* exported functions */

                    function updateData(data) {
                        updateDataVariables(data);

                        setDimensions();

                        updateScales();

                        // recalculate what tiles are visible
                        visibleTiles = tilingFunctions.filterTiles(self.tileSizeSeconds, self.resolution, self.items, visibleExtent, self.category);

                        updateElements();

                        // pulling our y-axis update because yScale never changes for updateMiddle
                        // and thus only changes from update data
                        yAxis.scale(yScale).tickValues(yScale.ticks(10).slice(0, -1).concat([self.visualizationYMax]));
                        yAxisGroup.call(yAxis);
                    }

                    function updateMiddle(newMiddle, category, currentZoomValue) {
                        self.middle = newMiddle;
                        self.category = category;
                        self.currentZoomValue = currentZoomValue;

                        updateScales();

                        // recalculate what tiles are visible
                        visibleTiles = tilingFunctions.filterTiles(self.tileSizeSeconds, self.resolution, self.items, visibleExtent, self.category);

                        updateElements();
                    }

                    /* internal functions*/

                    function create() {

                        // note this depends on the inputs being updated by reference
                        // or remaining constant
                        tilingFunctions = new TilingFunctions(dataFunctions, yScale, xScale, tileCache, resolutionScale, tileWidthPixels, true);

                        updateDataVariables(data);

                        setDimensions();

                        updateScales();

                        createElements();
                    }

                    function updateDataVariables(data) {
                        // data should be an array of items with extents
                        self.items = data.items;
                        self.maximum = data.maximum;
                        self.minimum = data.minimum;
                        self.visualizationYMax = data.visualizationYMax;
                        self.visualizationTileHeight = data.visualizationTileHeight;
                        self.middle = null;
                        self.currentZoomValue = 1;
                        self.availableResolutions = data.availableResolutions || [];
                        self.availableResolutions.sort((a, b) => a - b);
                    }

                    function setDimensions() {
                        tilesTotalWidthPixels = common.getWidth(container, margin);
                        tileCount = tilingFunctions.getTileCountForWidthRounded(tilesTotalWidthPixels, tileWidthPixels);


                        // want tilesHeightPixels to be a function of visualizationYMax and window
                        var newHeight = getTilesGroupHeight();
                        if (newHeight >= 0) {
                            tilesHeightPixels = newHeight;
                        }
                        var svgHeight = tilesHeightPixels + margin.top + margin.bottom;
                        svg.style("height", svgHeight + "px");

                        var attrs = {
                            width: tilesTotalWidthPixels,
                            height: tilesHeightPixels
                        };
                        tilesGroup.attr(attrs);
                        tilesBackground.attr(attrs);
                        datasetBoundsRect.attr("height", tilesHeightPixels);
                        if (tilesClipRect) {
                            tilesClipRect.attr(attrs);
                        }

                        focusLine.attr("height", tilesHeightPixels + common.focusStemPathDefaults.root);
                        focusTextGroup.translate(() => [0, -(common.focusStemPathDefaults.root + common.focusStemPathDefaults.stems)]);
                    }

                    function updateScales() {
                        let min = +self.minimum || 0,
                            max = +self.maximum || 0,
                            delta = max - min,
                            visibleFraction = delta / self.currentZoomValue;
                        // finally, convert to seconds
                        self.visibleDuration = visibleFraction / common.msInS;
                        // TODO: snap tile domain to zoom levels that are available
                        self.tileSizeSeconds = self.visibleDuration / tilingFunctions.getTileCountForWidth(tilesTotalWidthPixels, tileWidthPixels);
                        self.resolution = self.tileSizeSeconds / tileWidthPixels;


                        // update the controller with the visible tilesTotalWidthPixels
                        // NOTE: this control does not need to do this because it uses the same width as the detail control!
                        //dataFunctions.visualisationDurationUpdate(self.visibleDuration);
                        // calculate then end date for the domain
                        var halfVisibleDuration = self.visibleDuration / 2.0;
                        visibleExtent[0] = d3.time.second.offset(self.middle, -halfVisibleDuration);
                        visibleExtent[1] = d3.time.second.offset(self.middle, halfVisibleDuration);

                        xScale.domain(visibleExtent)
                            .range([0, tilesTotalWidthPixels]);

                        // inverted y-axis
                        yScale.domain([self.visualizationYMax, 0])
                            .range([0, tilesHeightPixels]);

                        TilingFunctions.updateResolutionScaleCeiling(self.availableResolutions, resolutionScale);
                    }



                    function createElements() {
                        //svg.node().addEventListener("SVGLoad", () => console.log("Main SVG Load completed"));

                        // this example has an associated html template...
                        // most of the creation is not necessary

                        tilesClipRect = svg.append("defs")
                            .append("clipPath")
                            .attr("id", clipId)
                            .append("rect")
                            .attr({
                                width: tilesTotalWidthPixels,
                                height: tilesHeightPixels
                            });

                        main.translate([margin.left, margin.top]);

                        tilesGroup.clipPath("url(#" + clipId + ")");

                        tilesGroup.on("click", (source) => common.navigateTo(tilingFunctions, dataFunctions, visibleTiles, xScale, source));

                        xAxis = new TimeAxis(main, xScale, {position: [0, tilesHeightPixels], isVisible: false});
                        yAxis = d3.svg.axis()
                            .scale(yScale)
                            .orient("left")
                            .tickSize(6)
                            .tickPadding(8);
                        yAxisGroup = main.append("g")
                            .classed("y axis", true)
                            .translate([0, 0])
                            .call(yAxis);

                        updateElements();
                    }



                    function updateElements() {
                        var rectAttrs = {
                                height: tilesHeightPixels,

                                /**
                                 * The relative width of the image is a function of the
                                 * the zoom panel's current scale vs the ideal scale of the tile.
                                 */
                                width: d => {
                                    var imageScale = d.resolution / self.resolution;
                                    return tileWidthPixels * (imageScale);
                                }
                            },
                            imageAttrs = {
                                height: rectAttrs.height,
                                /**
                                 * Disable automatic aspect ratio setting
                                 */
                                preserveAspectRatio: "none",
                                width: rectAttrs.width
                            };


                        const debugAttrs = {
                                date: d => d.offset.toString(),
                                tileResolution: d => d.resolution,
                                tileResolutionRatio: d => (d.resolution / self.resolution).toFixed(4)
                            },
                            debugGroupAttrs = {
                                actualResolution: self.resolution.toFixed(4),
                                tileSize: self.tileSizeSeconds.toLocaleString()
                            };

                        // reposition
                        focusGroup.translate(() => [xScale(self.middle), 0]);
                        let {url, roundedDate} = common.isNavigatable(tilingFunctions, dataFunctions, visibleTiles, self.middle);
                        focusText.text(() => {
                            if (self.middle) {
                                return "Go to " + timeFormatter(roundedDate);
                            }

                            return "";
                        });
                        focusAnchor.attr("xlink:href", url);
                        focusAnchor.classed("disabled", !url);
                        // this IS MEGA bad for performance - forcing a layout
                        //focusStem.attr("d", getFocusStemPath(focusText.node().getComputedTextLength()));
                        focusStem.attr("d", common.getFocusStemPath());

                        // debug only
                        tilesGroup.attr(debugGroupAttrs);

                        // create data join
                        var tileElements = tilesGroup.selectAll(".tile")
                            .data(visibleTiles, TilingFunctions.tileKey);

                        // update old tiles
                        tileElements.translate(tilingFunctions.getTileGTranslation)
                            .attr(debugAttrs)
                            .select("image")
                            .attr({
                                "xlink:href": common.imageCheck,
                                width: imageAttrs.width
                            });

                        // update dimensions for tile rects
                        tileElements.select("rect")
                            .attr({width: rectAttrs.width});

                        // add new tiles
                        var newTileElements = tileElements.enter()
                            .append("g")
                            .attr(debugAttrs)
                            .translate(tilingFunctions.getTileGTranslation)
                            .classed("tile", true);

                        // optimize: if we've successfully downloaded a tile before
                        // then we don't need these placeholder tiles
                        var failedOrUnknownTileElements = newTileElements.filter(common.isImageSuccessful);
                        //.data(visibleTiles, tileKey)
                        //.enter();
                        failedOrUnknownTileElements.append("rect")
                            .attr(rectAttrs);

                        // but always add the image element
                        newTileElements.append("image")
                            .attr(imageAttrs)
                            .attr("xlink:href", common.imageCheck)
                            .on("error", common.imageLoadError, true)
                            .on("load", common.imageLoadSuccess, true)
                            // the following two handlers are for IE compatibility
                            .on("SVGError", common.imageLoadError, true)
                            // the following hack does not work in IE
                            .on("SVGLoad", common.imageLoadSuccess, true);

                        // remove old tiles
                        tileElements.exit().remove();

                        // update datasetBounds
                        // effect a manual clip on the range
                        var dbMinimum = Math.max(visibleExtent[0], self.minimum);
                        var dbMaximum = Math.min(visibleExtent[1], self.maximum);
                        xScale.clamp(true);
                        datasetBoundsRect.attr({
                            x: xScale(dbMinimum) || 0.0,
                            width: Math.max(0, xScale(dbMaximum) - xScale(dbMinimum)) || 0.0
                        });
                        xScale.clamp(false);

                        var domain = xScale.domain(),
                        // intentionally falsey
                            showAxis = domain[1] - domain[0] != 0; // jshint ignore:line

                        xAxis.update(xScale, [0, tilesHeightPixels], showAxis);
                    }

                    /* helper functions */


                    function getTilesGroupHeight() {
                        return self.visualizationTileHeight;
                    }










                };
            }
        ]
    ).directive(
    "eventDistributionVisualisationMultiScale",
    [
        "conf.paths",
        "DistributionVisualisationMultiScale",
        function (paths, DistributionVisualisationMultiScale) {
            // directive definition object
            return {
                restrict: "EA",
                scope: false,
                require: "^^eventDistribution",
                templateUrl: paths.site.files.d3Bindings.eventDistribution.distributionVisualisation,
                link: function ($scope, $element, attributes, controller, transcludeFunction) {
                    var element = $element[0];
                    controller.visualisation.push(new DistributionVisualisationMultiScale(
                        element,
                        controller.data,
                        controller.options.functions,
                        $scope.$id));
                }
            };
        }
    ]
);