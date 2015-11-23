/**
 * Created by Anthony.
 *
 * Provides methods common to the distribution controls.
 */
angular
    .module("bawApp.d3.eventDistribution.distributionCommon", [])
    .factory(
        "distributionCommon",
        [
            "$rootScope",
            "$location",
            "d3",
            "roundDate",
            "distributionTilingFunctions",
            function ($rootScope, $location, d3, roundDate, TilingFunctions) {
                console.info("distributionCommon::Init: I SHOULD ONLY HAVE CALLED ONCE!");

                // caches to track image URLs for tiles. This way we avoid unnecessary HTTP requests.
                const failedImages = new Set(),
                    successfulImages = new Set();

                return {
                    focusStemPathDefaults: {
                        width: 91,
                        stems: 4,
                        root: 8
                    },
                    getFocusStemPath(width) {
                        let focusStemPath = this.focusStemPathDefaults,
                            w = Math.round(width || focusStemPath.width) + focusStemPath.stems,
                            hw = w / 2.0,
                            s = focusStemPath.stems,
                            r = focusStemPath.root;

                        return `m-${hw} 0 l0 ${s} l${w} 0 l0 -${s} m-${hw} ${s} l0 ${r}`;
                    },
                    getNavigateUrl(dataFunctions, category, tileSizeSeconds, tileWidthPixels, d, offset) {
                        var url = dataFunctions.getNavigateUrl(
                            offset,
                            category,
                            tileSizeSeconds,
                            tileWidthPixels,
                            d
                        );

                        if (url) {
                            return url;
                        }

                        return;
                    },
                    /**
                     * Get the best number of tiles for a given width.
                     * @param width
                     * @param tileWidthPixels
                     */
                    getTileCountForWidth(width, tileWidthPixels) {
                        // round high so that we always have enough tiles
                        // to fill a surface
                        return Math.ceil(width / tileWidthPixels);
                    },
                    getWidth(element, margin) {
                        var containerWidth = element.node().parentNode.getBoundingClientRect().width,
                            availableWidth = containerWidth - (margin.left + margin.right);

                        return availableWidth;
                    },
                    imageCheck(tile) {
                        // check if the image has been successfully downloaded before
                        // if it has not, do not set
                        // if it has, then set
                        // otherwise, set for first time and try!
                        if (failedImages.has(tile.tileImageUrl)) {
                            return null;
                        } else {
                            return tile.tileImageUrl;
                        }
                    },
                    imageLoadError(d, index) {
                        //console.error("SVG image error", arguments);
                        var target = d3.select(d3.event.target);

                        // remove the href from the image
                        target.attr("xlink:href", null);

                        // record failure so we don't try and DL image again
                        failedImages.add(d.tileImageUrl);
                    },
                    imageLoadSuccess(d) {
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
                    },
                    isImageSuccessful(tile) {
                        return !successfulImages.has(tile.tileImageUrl);
                    },
                    isNavigatable(dataFunctions, visibleTiles, clickDate) {
                        // round to nearest 30 seconds for navigation urls
                        const navigationOffsetRounding = 30;
                        let roundedDate = roundDate.round(navigationOffsetRounding, clickDate);

                        // plus one ms to cheat the system
                        // - the range should be valid, i.e. not zero width
                        let searchRange = [roundedDate, +roundedDate + 1];

                        // reuse filtering method but don't allow for padding
                        var matchedTiles = visibleTiles.filter(tile => {
                            return TilingFunctions.isTileVisible(searchRange, tile);
                        });

                        var url;
                        if (matchedTiles.length) {
                            // the source item that owns the tile
                            let itemFound = matchedTiles.find(tile => {
                                return TilingFunctions.isItemVisible(dataFunctions, searchRange, tile.source);
                            });

                            // the tile could still be outside of the item's actual range
                            // (as tiles are absolutely aligned and pad out items)
                            if (itemFound) {
                                url = this.getNavigateUrl(itemFound.source, roundedDate);
                            }
                        }

                        return {url, roundedDate};
                    },
                    msInS: 1e3,
                    /**
                     * Returns the middle point for a 1D interval.
                     * Will work with `Date` and `number` intervals
                     * @param interval - the interval to work on
                     * @returns {number} - the middle on the interval
                     */
                    middle(interval) {
                        return +interval[0] + ((+interval[1] - +interval[0]) / 2.0);
                    },
                    navigateTo(dataFunctions, visibleTiles, xScale, source) {
                        var coordinates = d3.mouse(source.node()),
                            clickDate = xScale.invert(coordinates[0]);

                        // now see if there is a match for the date!
                        var {url} = this.isNavigatable(dataFunctions, visibleTiles, clickDate);

                        if (url) {
                            console.warn(
                                "distributionCommon::Click: Navigating to ",
                                url,
                                new Date(clickDate));
                            $location.url(url);
                            $rootScope.$apply();
                        }
                        else {
                            console.error(
                                "distributionCommon::Click: Navigation failed",
                                new Date(clickDate));
                        }
                    },

                    svgHeight(mainHeight, margin) {
                        return mainHeight + margin.top + margin.bottom;
                    }
                };
            }
        ]
    );
