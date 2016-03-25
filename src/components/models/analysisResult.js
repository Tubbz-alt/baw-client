angular
    .module("bawApp.models.analysisResult", [])
    .factory("baw.models.AnalysisResult", [
        "baw.models.associations",
        "baw.models.ApiBase",

        "conf.paths",
        "$url",
        "humanize-duration",
        "filesize",
        "moment",
        "MimeType",
        function (associations, ApiBase, paths, $url, humanizeDuration, filesize, moment, MimeType) {

            class AnalysisResult extends ApiBase {
                constructor(resource, parent) {
                    super(resource);

                    this._parent = parent;
                    this.path = this.path || null;
                    this.name = this.name || null;
                    this.type = this.type || null;
                    this.mime = this.mime || null;
                    this.sizeBytes = this.sizeBytes || null;
                    this.hasChildren = this.hasChildren || false;

                    let children = [];
                    if (this.children) {
                        // recursive!
                        children = this.children.map(x => new AnalysisResult(x));
                    }
                    this.children = children;
                }

                get isDirectory() {
                    return this.type === "directory";
                }

                get isFile() {
                    return this.type === "file";
                }

                get friendlySize() {
                    if (this.sizeBytes) {
                        return filesize(this.sizeBytes, {round: 0});
                    }
                    else {
                        return "unknown";
                    }
                }
                
                get icon() {
                    return MimeType.mimeToFaIcon(this.mime);
                }

                //
                // get analysisDetailsUrl() {
                //     return $url.formatUri(
                //         paths.site.ngRoutes.analysisJobs.details,
                //         {analysisJobId: this.id}
                //     );
                // }

                // url to the resource
                get url() {
                    let url = paths.site.links.analysisJobs.analysisResults + this.path;

                    return $url.formatUri(
                        url,
                        {analysisJobId: this.id}
                    );
                }

                get viewUrl() {
                    let url = paths.site.links.analysisJobs.analysisResults + this.path;

                    return $url.formatUri(
                        url,
                        {analysisJobId: this.id}
                    );
                }
            }

            return AnalysisResult;
        }]);
