/**
 * Created by Anthony.
 *
 * Intended to show the visualisation chosen by the other event distribution controls
 * A large visual surface of SVG elements, controlled by d3
 * It shows a series of tiles
 *
 */
angular
    .module("bawApp.d3.eventDistribution.distributionVisualisation", [])
    .service(
    "DistributionVisualisation",
    [
        "d3",
        "roundDate",
        "TimeAxis",
        "$url",
        "conf.paths",
        function (d3, roundDate, TimeAxis, $url, paths) {
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
                    tilesClipRect,

                    tileSizePixels = 60,
                    tileSizeSeconds = 60 * 60,

                // default value, overridden almost straight away
                    tilesHeight = 256,
                // default value, overridden almost straight away
                    tilesWidth = 1440,
                // 86400 seconds
                    oneDay = 60 * 60 * 24,


                // seconds per pixel
                    resolution = updateResolution(),

                    clipId = "distributionVisualization_" + uniqueId,
                    xScale,
                    yScale,
                    xAxis,
                    xAxisHeight = 30,
                    yAxis,
                    yAxisGroup,
                    yAxisWidth = 52,
                    margin = {
                        top: 13,
                        right: 0,
                        left: 120 /* yAxisWidth*/,
                        bottom: 0 + xAxisHeight
                    },

                    visibleExtent = [],
                    visibleTiles = [],
                    failedImages = new Set(),
                    successfulImages = new Set();

                // exports
                self.items = [];
                self.nyquist = 11025;
                self.spectrogramWindowSize = 512;
                self.visibleDuration = oneDay;
                self.middle = null;
                self.category = null;
                self.updateData = updateData;
                self.updateMiddle = updateMiddle;

                // init
                create();

                /* exported functions */

                function updateData(data) {
                    updateDataVariables(data);

                    setDimensions();

                    updateScales();

                    generateTiles();

                    visibleTiles = filterTiles(visibleExtent, self.category);

                    updateElements();

                    // pulling our y-axis update because yScale never changes for updateMiddle
                    // and thus only changes from update data
                    yAxis.scale(yScale).tickValues(yScale.ticks(10).slice(0, -1).concat([self.nyquist]));
                    yAxisGroup.call(yAxis);
                }

                function updateMiddle(newMiddle, category) {
                    self.middle = newMiddle;
                    self.category = category;

                    updateScales();

                    visibleTiles = filterTiles(visibleExtent, self.category);

                    updateElements();
                }

                /* internal functions*/

                function create() {
                    updateDataVariables(data);

                    setDimensions();

                    updateScales();

                    generateTiles();

                    createElements();
                }

                function updateDataVariables(data) {
                    // data should be an array of items with extents
                    self.items = data.items;
                    self.maximum = data.maximum;
                    self.minimum = data.minimum;
                    self.nyquistFrequency = data.nyquistFrequency;
                    self.spectrogramWindowSize = data.spectrogramWindowSize;
                    self.middle = null;
                }

                function setDimensions() {
                    var widths = getWidth();
                    tilesWidth = widths.width;
                    self.visibleDuration = widths.duration;

                    // want tilesHeight to be a function of nyquistRate and window
                    var newHeight = getTilesGroupHeight();
                    if (newHeight >= 0) {
                        tilesHeight = newHeight;
                    }
                    var svgHeight = tilesHeight + margin.top + margin.bottom;
                    svg.style("height", svgHeight + "px");

                    var attrs = {
                        width: tilesWidth,
                        height: tilesHeight
                    };
                    tilesGroup.attr(attrs);
                    tilesBackground.attr(attrs);
                    datasetBoundsRect.attr("height", tilesHeight);
                    if (tilesClipRect) {
                        tilesClipRect.attr(attrs);
                    }

                    // update the controller with the visible tilesWidth
                    dataFunctions.visualisationDurationUpdate(self.visibleDuration);
                }

                function updateScales() {
                    // calculate then end date for the domain
                    var halfVisibleDuration = self.visibleDuration / 2.0;
                    visibleExtent[0] = d3.time.second.offset(self.middle, -halfVisibleDuration);
                    visibleExtent[1] = d3.time.second.offset(self.middle, halfVisibleDuration);

                    xScale = d3.time.scale()
                        .domain(visibleExtent)
                        .range([0, tilesWidth]);

                    yScale = d3.scale.linear()
                        // inverted y-axis
                        .domain([self.nyquistFrequency, 0])
                        .range([0, tilesHeight]);
                }

                function generateTiles() {
                    if (self.items && self.items.length > 0) {
                        // need to generate a series of tiles that can show the data in that.items
                        self.items.forEach(function (current) {
                            // warning: to future self: this is creating cyclic references
                            // as each tile keeps a reference to current
                            current.tiles = splitIntoTiles(current);
                        });
                    }
                }

                function filterTiles(visibleExtent, category) {
                    var filterPadding = tileSizeSeconds * 1000;
                    // item filter
                    // pad the filtering extent with tileSize so that recordings that have
                    // duration < tileSize aren't filtered out prematurely
                    var fExtent = [(+visibleExtent[0]) - filterPadding, (+visibleExtent[1]) + filterPadding],
                        f = isItemVisible.bind(null, fExtent),
                        g = isInCategory.bind(null, category),
                        h = and.bind(null, g, f);

                    // tile filter
                    var l = isTileVisible.bind(null, visibleExtent);

                    return self.items
                        .filter(h)
                        .reduce(function (previous, current) {
                            var t = current.tiles.filter(l);
                            return previous.concat(t);
                        }, [])
                        .sort(sortTiles);
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
                            width: tilesWidth,
                            height: tilesHeight
                        });

                    main.translate([margin.left, margin.top]);

                    tilesGroup.clipPath("url(#" + clipId + ")");

                    xAxis = new TimeAxis(main, xScale, {position: [0, tilesHeight], isVisible: false});
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
                    var imageAttrs = {
                        height: tilesHeight,
                        width: tileSizePixels
                    };

                    function tileGTranslation(d, i) {
                        return [getTileLeft(d, i), 0];
                    }

                    function checkImage(d) {
                        // check if the image has been successfully downloaded before
                        // if it has not, do not set
                        // if it has, then set
                        // otherwise, set for first time and try!
                        if (failedImages.has(d.tileImageUrl)) {
                            return null;
                        } else {
                            return d.tileImageUrl;
                        }
                    }

                    function imageLoadError(d, index) {
                        //console.error("SVG image error", arguments);
                        var target = d3.select(d3.event.target);

                        // remove the href from the image
                        target.attr("xlink:href", null);

                        // record failure so we don't try and DL image again
                        failedImages.add(d.tileImageUrl);
                    }

                    function imageLoadSuccess(d) {
                        //console.info("SVG image success", arguments);
                        if (successfulImages.has(d.tileImageUrl)) {
                            return;
                        }

                        // if successful, remove text (and let bg color through)
                        var target = d3.event.target,
                            siblings = target.parentNode.childNodes;
                        Array.from(siblings).forEach(function (node, index) {
                            if (!(node instanceof SVGImageElement)) {
                                node.remove();
                            }
                        });

                        // record success so we can optimise tile creation in the future
                        successfulImages.add(d.tileImageUrl);
                    }

                    function tileKey(d) {
                        return d.key;
                    }

                    // create data join
                    var tileElements = tilesGroup.selectAll(".tile")
                        .data(visibleTiles, tileKey);

                    // update old tiles
                    tileElements.translate(tileGTranslation)
                        .select("image")
                        .attr("xlink:href", checkImage);

                    // add new tiles
                    var newTileElements = tileElements.enter()
                        .append("g")
                        .translate(tileGTranslation)
                        .classed("tile", true)
                        .append("a")
                        .attr("xlink:href", function (d, i) {
                            return d.audioNavigationUrl;
                        });

                    // optimize: if we've successfully downloaded a tile before
                    // then we don't need these placeholder tiles
                    var failedOrUnknownTileElements =
                        newTileElements.filter(d => !successfulImages.has(d.tileImageUrl));
                        //.data(visibleTiles, tileKey)
                        //.enter();
                    failedOrUnknownTileElements.append("rect")
                        .attr(imageAttrs);

                    failedOrUnknownTileElements.append("text")
                        .text(getOffsetDate)
                        .attr({
                            y: tilesHeight / 2.0,
                            x: tileSizePixels / 2.0,
                            width: tilesWidth,
                            "text-anchor": "middle",
                            dy: "0em"
                        });
                    failedOrUnknownTileElements.append("text")
                        .text(getOffsetTime)
                        .attr({
                            y: tilesHeight / 2.0,
                            x: tileSizePixels / 2.0,
                            width: tileSizePixels,
                            "text-anchor": "middle",
                            dy: "1em"
                        });

                    // but always add the image element
                    newTileElements.append("image")
                        .attr(imageAttrs)
                        .attr("externalResorucesRequired", "true")
                        .attr("xlink:href", checkImage)
                        .on("error", imageLoadError, true)
                        .on("load", imageLoadSuccess, true)
                        .on("SVGError", imageLoadError, true)
                        .on("SVGLoad", imageLoadSuccess, true);

                    // remove old tiles
                    tileElements.exit().remove();
                    //failedOrUnknownTileElements.exit().remove();

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

                    xAxis.update(xScale, [0, tilesHeight], showAxis);
                }

                /* helper functions */

                function updateResolution() {
                    resolution = tileSizeSeconds / tileSizePixels;
                    return resolution;
                }

                function getWidth() {
                    // want tilesWidth to be a factor of tile size
                    var containerWidth = svg.node().parentNode.getBoundingClientRect().width;
                    var availableWidth = containerWidth - (margin.left + margin.right);
                    var tileCount = Math.floor(availableWidth / tileSizePixels);
                    return {width: tileCount * tileSizePixels, duration: tileCount * tileSizeSeconds};
                }

                function getTilesGroupHeight() {
                    return (self.spectrogramWindowSize / 2);
                }

                function isInCategory(category, d) {
                    return dataFunctions.getCategory(d) === category;
                }

                function isItemVisible(filterExtent, d) {
                    return dataFunctions.getLow(d) < filterExtent[1] &&
                        dataFunctions.getHigh(d) >= filterExtent[0];
                }

                function and(a, b, d) {
                    return a(d) && b(d);
                }

                function isTileVisible(visibleExtent, d) {
                    return d &&
                        d.offset < visibleExtent[1] &&
                        d.offsetEnd >= visibleExtent[0];
                }

                function splitIntoTiles(current, i) {
                    // coerce just in case (d3 does this internally)
                    var low = new Date(dataFunctions.getLow(current)),
                        high = new Date(dataFunctions.getHigh(current));

                    // round down to the lower unit of time, determined by `tileSizeSeconds`
                    var niceLow = roundDate.floor(tileSizeSeconds, low),
                        // subtract a 'tile' otherwise we generate one too many
                        niceHigh = roundDate.ceil(tileSizeSeconds, high) - tileSizeSeconds,
                        offset = niceLow;

                    // use d3's in built range functionality to generate steps
                    var steps = [];
                    while (offset < niceHigh) {
                        var nextOffset = d3.time.second.offset(offset, tileSizeSeconds);
                        var item = {
                            offset: offset,
                            offsetEnd: nextOffset,
                            source: current,
                            key: offset.toISOString() + dataFunctions.getId(current),
                            audioNavigationUrl: getNavigateToAudioUrl(current, offset),
                            tileImageUrl: ""
                        };
                        item.tileImageUrl = getTileImage(item);
                        steps.push(item);
                        offset = nextOffset;
                    }

                    return steps;
                }

                function getNavigateToAudioUrl(source, tileStart) {

                    var ar = source,
                        id = ar.id,
                        startOffset = (tileStart - ar.recordedDate) / 1000;

                    // do not allow negative indexing!
                    if (startOffset < 0) {
                        startOffset = 0;
                    }

                    // intentionally not specifying an end offset - let the listen page decide
                    return $url.formatUri(paths.site.ngRoutes.listen,
                        {
                            recordingId: id,
                            start: startOffset
                        });

                }

                function getTileLeft(d, i) {
                    return xScale(d.offset);
                }

                function getOffsetDate(d) {
                    return d.offset.toLocaleDateString();
                }

                function getOffsetTime(d) {
                    return d.offset.toLocaleTimeString();
                }

                function getTileImage(d) {
                    var url = dataFunctions.getTileUrl(d.offset,
                        self.category,
                        tileSizeSeconds,
                        tileSizePixels,
                        d);

                    if (url) {
                        return url;
                    }

                    return "";
                }

                /**
                 * Order tiles based on their date. This allows elements to be painted in the
                 * DOM in the right order
                 * @param tileA
                 * @param tileB
                 */
                function sortTiles(tileA, tileB) {
                    return tileA.offset - tileB.offset;
                }

            };
        }
    ]
).directive(
    "eventDistributionVisualisation",
    [
        "conf.paths",
        "DistributionVisualisation",
        function (paths, DistributionVisualisation) {
            // directive definition object
            return {
                restrict: "EA",
                scope: false,
                require: "^^eventDistribution",
                templateUrl: paths.site.files.d3Bindings.eventDistribution.distributionVisualisation,
                link: function ($scope, $element, attributes, controller, transcludeFunction) {
                    var element = $element[0];
                    controller.visualisation = new DistributionVisualisation(
                        element,
                        controller.data,
                        controller.options.functions,
                        $scope.$id);
                }
            };
        }
    ]
);