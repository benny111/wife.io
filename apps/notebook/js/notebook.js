/*
 * TODOs:
 * 1) Search
 * 2) Delete confirm dialog
 */

function Notebook(fileManager) {
    var self = this;
    this.node = undefined;
    this.notes = undefined;
    this.fileManager = fileManager;
    this.jqueryElement = $("#notebook");
    this.tableView = new TableView($("#note-list"));
    this.tableView.dataSource = this;
    this.sortFuncs = [
        /* Sort by last modified date */
        function(a, b) { if (a.stat.mtime > b.stat.mtime) return -1; if (a.stat.mtime < b.stat.mtime) return 1; return 0; },
        /* Sort by creation date (newest first) */
        function(a, b) { return (basename(b.path) - basename(a.path)) },
        /* Sort by creation date (oldest first) */
        function(a, b) { return (basename(a.path) - basename(b.path)) },
        /* Sort by title (ascending) */
        function(a, b) { if (a.title < b.title) return -1; if (a.title > b.title) return 1; return 0; },
        /* Sort by title (descending) */
        function(a, b) { if (a.title > b.title) return -1; if (a.title < b.title) return 1; return 0; }
    ];
    this.currentSortMethod = 0;

    /* Build real path from node or string */
    this.getPath = function(node) {
        var path = "";

        if (typeof node === "object")
            path = "/" + node.name;
        else if (typeof node === "string")
            path = node;

        return "bookshelf" + path;
    };

    /* Build time code */
    this.getTimecode = function() {
        var now = new Date();
        return now.getFullYear()
               + ("0" + (now.getMonth() + 1)).slice(-2)
               + ("0" + now.getDate()).slice(-2)
               + ("0" + now.getHours()).slice(-2)
               + ("0" + now.getMinutes()).slice(-2)
               + ("0" + now.getSeconds()).slice(-2)
               + ("0" + now.getMilliseconds()).slice(-2);
    };

    /* Popup note edit menu */
    var noteEditMenu;
    this.popupEditMenu = function(arg) {
        arg.event.stopPropagation();
        arg.event.preventDefault();

        if (noteEditMenu) {
            if (noteEditMenu.is(":visible"))
                noteEditMenu.hide();
            else
                noteEditMenu.show();
        }
        else {
            noteEditMenu = $(
                "<ul style='position:absolute;z-index:9999;'>" +
                "<li>Copy</li>" +
                "<li>Delete</li>" +
                "</ul>"
            )
            .menu()
            .appendTo("body");
        }

        noteEditMenu.off("menuselect");
        noteEditMenu.position({
            my: "left top",
            of: arg.event
        })
        .on("menuselect", function(event, ui) {
            event.preventDefault();

            var selectedOption = ui.item.text();
            noteEditMenu.hide();

            if (selectedOption === "Copy") {
                self.copyNote(arg.index);
            }
            else if (selectedOption === "Delete") {
                self.deleteNote(arg.index);
            }
        });
    };

    /* Popup option menu */
    var optionMenu;
    this.toggleOptionMenuCheckIcon = function(index) {
        $("#note-option-menu").find("li").eq(this.currentSortMethod).find("span").remove();
        $("#note-option-menu").find("li").eq(index).prepend("<span class='ui-icon ui-icon-check'></span>");
        this.currentSortMethod = index;
    };

    this.popupOptionMenu = function(event) {
        event.stopPropagation();
        event.preventDefault();

        if (optionMenu) {
            if (optionMenu.is(":visible"))
                optionMenu.hide();
            else
                optionMenu.show();
        }
        else {
            optionMenu = $(
                "<ul id='note-option-menu' style='position:absolute;z-index:9999;'>" +
                "<li><span class='ui-icon ui-icon-check'></span>Sort by last modified date" +
                "<li>Sort by creation date (newest first)</li>" +
                "<li>Sort by creation date (oldest first)</li>" +
                "<li>Sort by title (ascending)</li>" +
                "<li>Sort by title (descending)</li>" +
                "</ul>"
            )
            .menu()
            .appendTo("body");
        }

        optionMenu.off("menuselect");
        optionMenu.position({
            my: "left bottom",
            of: event
        })
        .on("menuselect", function(event, ui) {
            event.preventDefault();

            var selectedOption = ui.item.text();
            optionMenu.hide();

            if (selectedOption === "Sort by last modified date") {
                self.toggleOptionMenuCheckIcon(0);
            }
            else if (selectedOption === "Sort by creation date (newest first)") {
                self.toggleOptionMenuCheckIcon(1);
            }
            else if (selectedOption === "Sort by creation date (oldest first)") {
                self.toggleOptionMenuCheckIcon(2);
            }
            else if (selectedOption === "Sort by title (ascending)") {
                self.toggleOptionMenuCheckIcon(3);
            }
            else if (selectedOption === "Sort by title (descending)") {
                self.toggleOptionMenuCheckIcon(4);
            }

            /* Sort notes */
            self.notes.sort(self.sortFuncs[self.currentSortMethod]);
            /* Load notes on list */
            self.tableView.show();
        });
    };

    $("#note-options").click(this.popupOptionMenu);

    this.listenToEvents = function() {
        var self = this;

        self.tableView.view.off("tableview.show");
        self.tableView.view.on("tableview.show", function(event) {
            self.updateTitleBar();
        });

        self.tableView.view.off("tableview.contextmenu");
        self.tableView.view.on("tableview.contextmenu", function(event, arg) {
            self.popupEditMenu(arg);
        });

        self.tableView.view.off("tableview.select");
        self.tableView.view.on("tableview.select", function(event, index) {
            self.jqueryElement.trigger("notebook.select", { path: self.notes[index].path + "/note.html", index: index });
        });

        self.tableView.view.off("tableview.deselect");
        self.tableView.view.on("tableview.deselect", function(event, index) {
            self.jqueryElement.trigger("notebook.deselect", { index: index });
        });
    };

    $(document).on("click", function(e) {
        var $target = $(e.target);
        if (noteEditMenu) noteEditMenu.hide();
        if (optionMenu) optionMenu.hide();
    });
}

extend(Notebook.prototype, TableViewDataSource.prototype);

Notebook.prototype.fitSize = function(width, height) {
    $("#notebook-title-bar").width(width * 0.2);
    $("#note-list").width(width * 0.2);
    $("#note-list").height(height - 30 - 30);
    $("#note-manage-bottom-bar").width(width * 0.2);
}

Notebook.prototype.updateTitleBar = function() {
    var self = this;

    $("#notebook-title-bar").find("span").remove();

    if (self.notebookNode) {
        if (self.notebookNode.isFolder())
            $("#notebook-title-bar").append("<span class='notebook-title'><i class='fa fa-list'></i>&nbsp;" + self.notebookNode.name + "</span>");
        else
            $("#notebook-title-bar").append("<span class='notebook-title'><i class='fa fa-book'></i>&nbsp;" + self.notebookNode.name + "</span>");

        if (self.notes.length > 0)
            $("#notebook-title-bar").append("<span class='notebook-count'>(" + self.notes.length + " notes)</span>");
    }
}

Notebook.prototype.open = function(node) {
    var self = this;

    self.notebookNode = node;
    self.notes = [];

    self.updateTitleBar();

    if (node.isFolder()) {
        var recursiveIterateList = function(notebookIndex) {
            if (notebookIndex < node.children.length) {
                var child = node.children[notebookIndex];
                self.fileManager.iterateStatList(
                    self.getPath(child),
                    function(path, item, stat, i, error) {
                        if (error)
                            console.log("Unable to list " + path + "/" + item);
                        else
                            self.notes.unshift({ path: path + "/" + item, stat: stat, title: "" });
                    },
                    function(path) {
                        if (notebookIndex === node.children.length - 1) {
                            /* Sort notes */
                            self.notes.sort(self.sortFuncs[self.currentSortMethod]);
                            /* Load notes on list */
                            self.tableView.show();
                        } else
                            recursiveIterateList(notebookIndex + 1);
                    }
                );
            }
        };

        /* Recursively list all notes in all notebook */
        recursiveIterateList(0);
    }
    else {
        self.fileManager.iterateStatList(
            self.getPath(node),
            function(path, item, stat, i, error) {
                if (error)
                    console.log("Unable to list " + path + "/" + item);
                else
                    self.notes.unshift({ path: path + "/" + item, stat: stat, title: "" });
            },
            function(path) {
                /* Sort notes */
                self.notes.sort(self.sortFuncs[self.currentSortMethod]);
                /* Load notes on list */
                self.tableView.show();
            }
        );
    }

    self.listenToEvents();
}

Notebook.prototype.close = function() {
    var self = this;

    self.notebookNode = undefined;
    self.notes = [];

    self.updateTitleBar();

    self.tableView.show();
    self.listenToEvents();
}

Notebook.prototype.addNote = function(title, content, complete) {
    var self = this;
    var timecode = self.getTimecode();
    var notePath = self.getPath(self.notebookNode) + "/" + timecode;

    self.fileManager.exist(notePath, function(path, exist, isDir, error) {
        if (error) throw new Error("fs operation error");
        if (!exist) {
            self.fileManager.createDirectory(path, function(path, error) {
                if (error) throw new Error("unable to create directory");
                title = title || "Untitled";
                content = content || "";
                var emptyNote = "<html><head><title>" + title + "</title></head><body>" + content + "</body></html>";

                self.fileManager.writeFile(path + "/note.html", emptyNote, function(path, progress, error) {
                    if (error) throw new Error("unable to write note.html");

                    self.fileManager.stat(path, function(path, stat, error) {
                        if (error) throw new Error("unable to get stat of " + path);
                        self.notes.unshift({ path: notePath, stat: stat, title: title });
                        self.tableView.insertRowAtIndex(0, function() {
                            self.tableView.selectRowAtIndex(0);
                        });
                        self.updateTitleBar();
                        if (complete) complete(path);
                    });
                });

                //self.fileManager.createDirectory(path + "/assets", function(path, error) {
                //    if (error) throw new Error("unable to create assets directory");
                //});
            });
        }
        else {
            /* Recursively call addNote to get different timecode as note path name */
            self.addNote(title, content);
        }
    });
}

Notebook.prototype.deleteNote = function(index, complete) {
    var self = this;

    if (index >= self.notes.length)
        return;

    self.fileManager.exist(self.notes[index].path, function(path, exist, isDir, error) {
        if (error) throw new Error("fs operation error");
        if (exist) {
            self.fileManager.remove(path, function(path, error) {
                if (error) throw new Error("unable to remove " + path);
                self.notes.splice(index, 1);
                self.tableView.removeRowAtIndex(index);
                self.updateTitleBar();
                if (complete) complete(path);
            });
        }
    });
}

Notebook.prototype.copyNote = function(index, complete) {
    var self = this;

    if (index >= self.notes.length)
        return;

    self.fileManager.exist(self.notes[index].path, function(path, exist, isDir, error) {
        if (error) throw new Error("fs operation error");
        if (exist) {
            var timecode = self.getTimecode();
            var copyPath = dirname(path) + "/" + timecode;
            self.fileManager.copy(path, copyPath, function(srcPath, dstPath, error) {
                if (error) throw new Error("unable to copy " + path);
                self.fileManager.stat(dstPath, function(path, stat, error) {
                    if (error) throw new Error("unable to get stat of " + path);
                    self.notes.unshift({ path: path, stat: stat, title: self.notes[index].title });
                    self.tableView.insertRowAtIndex(0, function() {
                        self.tableView.selectRowAtIndex(0);
                    });
                    self.updateTitleBar();
                    if (complete) complete();
                });
            });
        }
    });
}

Notebook.prototype.reloadNote = function(index) {
    this.tableView.reloadRowAtIndex(index);
}

/* Tableview data source */
Notebook.prototype.tableViewNumberOfRows = function() {
    return this.notes.length;
}

Notebook.prototype.tableViewCellForRowAtIndex = function(index, appendDivToTableRow) {
    var self = this;
    var tempDiv = $("<div></div>");

    if (index >= self.notes.length)
        return;

    /* TODO: read partial file by given filter to reduce traffic */
    self.fileManager.readFile(self.notes[index].path + "/note.html", "utf8", function(path, data, error) {
        if (error) {
            console.log("Unable to read " + self.notes[index].path + "/note.html");
            appendDivToTableRow(tempDiv, index);
            return;
        }

        self.notes[index].title = tempDiv.append(data).find("title").text();

        var mtime = new Date(self.notes[index].stat.mtime);
        var lastModifiedDate = mtime.toLocaleDateString() + " " + mtime.toLocaleTimeString();

        appendDivToTableRow(
            "<div><p class='note-title'>" + self.notes[index].title + "</p>" +
            "<p class='note-last-modified-date'>Modified: " + lastModifiedDate  + "</p></div>",
            index
        );
    });
}
