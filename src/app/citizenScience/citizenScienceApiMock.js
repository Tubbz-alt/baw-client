var csApiMock = angular.module("bawApp.citizenScience.csApiMock", ["bawApp.citizenScience.common"]);


/**
 * Mocks the api responses for citizenScienceProjects that
 * will eventually go on the server
 */





csApiMock.factory("CsApi", [
    "CitizenScienceCommon",
    "$http",
    function CsApi(CitizenScienceCommon, $http) {

        var self = this;

        self.useLocalData = true;

        self.sheets_api_url = "http://" + window.location.hostname + ":8081";
        self.local_api_url = "/public/citizen_science";


        /**
         * Constructs a url for the request by concatenating the arguments, joined by "/"
         * and appending to the relevant baseURL
         * @returns {string|*}
         */
        self.apiUrl = function () {
            // convert to array
            var base_url, url;
            if (self.useLocalData) {
                base_url = self.local_api_url;
            } else {
                base_url = self.sheets_api_url;
            }
            var args = Array.prototype.slice.call(arguments);

            url = [base_url].concat(args).join("/");

            if (self.useLocalData) {
                url = url + ".json";
            }

            return url;
        };

        /**
         * Load and save all samples on page load
         */
        $http.get(self.apiUrl(
            "samples",
            "ebb")).then(function (response) {
            self.allSamples = response.data;
        });



        self.publicFunctions = {

            /**
             * Gets the media data for the specified sample
             * @param recording_id
             * @param offset
             */
            getSample : function (datasetItemId) {

                    var url = self.apiUrl(
                        "samples",
                        "ebb",
                        "phil");
                    //TODO: error handling
                    return $http.get(url).then(function (response) {


                        // mock version returns all samples. Then we search then here to get the right one

                        var itemNum = response.data.findIndex(item => item.id === datasetItemId);

                        if (itemNum === -1) {
                            return {};
                        }

                        var item = response.data[itemNum];
                        if (itemNum > 0) {
                            item.previousSampleId = response.data[itemNum - 1].id;
                        } else {
                            item.previousSampleId = null;
                        }
                        if (itemNum < response.data.length-1) {
                            item.nextSampleId = response.data[itemNum + 1].id;
                        } else {
                            item.nextSampleId = null;
                        }




                        return item;
                    });
            },
            /**
             * Gets the identifiers for the next sample
             * to be used for navigation
             * @param recording_id
             * @param offset
             */
            getNextSample : function (datasetItemId) {
                var url = self.apiUrl(
                    "nextSample",
                    "ebb");
                return $http.get(url).then(function (response) {
                    return response.data;
                });

            },
            /**
             * Gets the identifiers for the previous sample, to be used for navigation
             * @param recording_id
             * @param offset
             */
            getPrevousSample : function (datasetItemId) {
                var url = self.apiUrl(
                    "previousSample",
                    "ebb");
                return $http.get(url).then(function (response) {
                    return response.data;
                });

            },

            getLabels: function (project) {
                var response = $http.get(self.apiUrl(
                    "labels",
                    project
                ));

                return response.then(function (response) {
                    var labels = [];
                    if (Array.isArray(response.data)) {
                        labels = response.data;
                    }

                    return labels;
                });
            },

            getSettings: function (project) {
                return $http.get(self.apiUrl(
                    "settings",
                    project
                ));
            }

        };

        return self.publicFunctions;



    }]);

