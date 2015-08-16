angular.module("bawApp.predictiveCacheDefaultProfiles", [])
    .value(
    "predictiveCacheDefaultProfiles", {
        "Media cache ahead": function bind($location, paths) {
            const imageFormat = "png";
            const audioFormat = "mp3";
            // request additional bits of media based the duration of the original request
            // do not make requests that would exceed the end of the recording
            function mediaProgressor(previous, data) {
                var media = data.responseData.data,
                    duration = media.commonParameters.endOffset - media.commonParameters.startOffset,
                    next = previous + duration,
                    max = media.recording.durationSeconds;

                if (next >= max) {
                    return;
                }
                else {
                    return next;
                }
            }

            function formatMediaUrl(url, counters) {
                return paths.api.root + url
                        .replace(/start_offset=[\.\d]+/, "start_offset=" + counters[0])
                        .replace(/end_offset=[\.\d]+/, "end_offset=" + counters[1]);
            }

            return {
                name: "Media cache ahead",
                match: function (url, response) {
                    // match only if on listen page and request is for a media's json
                    if ($location.path().indexOf("/listen") === 0 &&
                        /\/audio_recordings\/[\.\d]+\/media\.json.*/.test(url)) {
                        var so = response.config.params.start_offset;
                        var eo = response.config.params.end_offset;

                        return so !== undefined && eo !== undefined ? [so, eo] : null;
                    }

                    return null;
                },
                request: [
                    // spectrogram
                    function (counters, data) {
                        return formatMediaUrl(data.responseData.data.available.image[imageFormat].url, counters);
                    },
                    // mp3
                    function (counters, data) {
                        return formatMediaUrl(data.responseData.data.available.audio[audioFormat].url, counters);
                    }
                ],
                progression: [
                    mediaProgressor, mediaProgressor
                ],
                count: 10,
                method: "HEAD",
                progressive: true
            };
        }
    }
);