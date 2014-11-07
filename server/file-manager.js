var fs = require('fs-extra'),
    ss = require('socket.io-stream');
var SYSTEM = require('../system');

module.exports = FileManager;

function FileManager() {}

FileManager.prototype.register = function(_super, socket, protoFS) {
    var self = this;
    var security = _super.securityManager[socket];

    /**
     * Protocol Listener: File System Events
     */
    socket.on(protoFS.List.REQ, function(path) {
        try {
            var items = fs.readdirSync(security.getUserDataPath(path));
            socket.emit(protoFS.List.RES, path, items);
        }
        catch (err) {
            console.log('List: ' + err);
            socket.emit(protoFS.List.ERR, path, SYSTEM.ERROR.FSNotExist);
        }
    });

    socket.on(protoFS.CreateFile.REQ, function(path) {
        fs.createFile(security.getUserDataPath(path), function(err) {
            if (err) {
                console.log('CreateFile: ' + err);
                socket.emit(protoFS.CreateFile.ERR, path, SYSTEM.ERROR.FSIOError);
            }
            else
                socket.emit(protoFS.CreateFile.RES, path);
        });
    });

    socket.on(protoFS.CreateDirectory.REQ, function(path) {
        fs.mkdirp(security.getUserDataPath(path), function(err) {
            if (err) {
                console.log('CreateDirectory: ' + err);
                socket.emit(protoFS.CreateDirectory.ERR, path, SYSTEM.ERROR.FSIOError);
            }
            else
                socket.emit(protoFS.CreateDirectory.RES, path);
        });
    });

    socket.on(protoFS.CreateHardLink.REQ, function(srcPath, dstPath) {
        var realSrcPath = security.getUserDataPath(srcPath);
        var realDstPath = security.getUserDataPath(dstPath);

        if (!fs.existsSync(realSrcPath))
            socket.emit(protoFS.CreateHardLink.ERR, srcPath, dstPath, SYSTEM.ERROR.FSNotExist);
        else if (!fs.linkSync(realSrcPath, realDstPath))
            socket.emit(protoFS.CreateHardLink.ERR, srcPath, dstPath, SYSTEM.ERROR.FSIOError);
        else
            socket.emit(protoFS.CreateHardLink.RES, srcPath, dstPath);
    });

    socket.on(protoFS.CreateSymbolicLink.REQ, function(srcPath, dstPath) {
        var realSrcPath = security.getUserDataPath(srcPath);
        var realDstPath = security.getUserDataPath(dstPath);

        if (!fs.existsSync(realSrcPath))
            socket.emit(protoFS.CreateSymbolicLink.ERR, srcPath, dstPath, SYSTEM.ERROR.FSNotExist);
        else if (!fs.symlinkSync(realSrcPath, realDstPath))
            socket.emit(protoFS.CreateSymbolicLink.ERR, srcPath, dstPath, SYSTEM.ERROR.FSIOError);
        else
            socket.emit(protoFS.CreateSymbolicLink.RES, srcPath, dstPath);
    });

    socket.on(protoFS.Remove.REQ, function(path) {
        var realPath = security.getUserDataPath(path);

        if (fs.existsSync(realPath)) {
            fs.remove(realPath, function(err) {
                if (err) {
                    console.log('Remove: ' + err);
                    socket.emit(protoFS.Remove.ERR, path, SYSTEM.ERROR.FSIOError);
                }
                else
                    socket.emit(protoFS.Remove.RES, path);
            });
        }
        else
            socket.emit(protoFS.Remove.ERR, path, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.Move.REQ, function(srcPath, dstPath) {
        var realSrcPath = security.getUserDataPath(srcPath);
        var realDstPath = security.getUserDataPath(dstPath);

        if (fs.existsSync(realSrcPath)) {
            fs.move(realSrcPath, realDstPath, function(err) {
                if (err) {
                    console.log('Move: ' + err);
                    socket.emit(protoFS.Move.ERR, srcPath, dstPath, SYSTEM.ERROR.FSIOError);
                }
                else
                    socket.emit(protoFS.Move.RES, srcPath, dstPath);
            });
        }
        else
            socket.emit(protoFS.Move.ERR, srcPath, dstPath, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.Copy.REQ, function(srcPath, dstPath) {
        var realSrcPath = security.getUserDataPath(srcPath);
        var realDstPath = security.getUserDataPath(dstPath);

        if (fs.existsSync(realSrcPath)) {
            fs.copy(realSrcPath, realDstPath, function(err) {
                if (err) {
                    console.log('Copy: ' + err);
                    socket.emit(protoFS.Copy.ERR, srcPath, dstPath, SYSTEM.ERROR.FSIOError);
                }
                else
                    socket.emit(protoFS.Copy.RES, srcPath, dstPath);
            });
        }
        else
            socket.emit(protoFS.Copy.ERR, srcPath, dstPath, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.Exist.REQ, function(path) {
        var exist = fs.existsSync(security.getUserDataPath(path));
        var isDir = exist ? fs.lstatSync(security.getUserDataPath(path)).isDirectory() : false;
        socket.emit(protoFS.Exist.RES, path, exist, isDir);
    });

    socket.on(protoFS.ReadFile.REQ, function(path, encoding) {
        var realPath = security.getUserDataPath(path);

        encoding = encoding || 'utf8';

        if (fs.existsSync(realPath)) {
            /*
            var readStream = fs.createReadStream(path);
            readStream.on('open', function () {
                var dataStream = ss.createStream();
                ss(socket).emit(protoFS.ReadFile.RES, path, dataStream);
                readStream.pipe(dataStream);
            });

            readStream.on('error', function(err) {
                socket.emit(protoFS.ReadFile.ERR, path, SYSTEM.ERROR.FSIOError);
            });
            */

            fs.readFile(realPath, encoding, function(err, data) {
                if (err) {
                    console.log('ReadFile: ' + err);
                    socket.emit(protoFS.ReadFile.ERR, path, SYSTEM.ERROR.FSIOError);
                }
                else {
                    socket.emit(protoFS.ReadFile.RES, path, { data: data });
                }
            });

        }
        else
            socket.emit(protoFS.ReadFile.ERR, path, SYSTEM.ERROR.FSNotExist);
    });

    ss(socket).on(protoFS.WriteFile.REQ, function(path, dataStream) {
        var realPath = security.getUserDataPath(path);

        var writeStream = fs.createWriteStream(realPath);
        dataStream.pipe(writeStream);

        dataStream.on('finish', function() {
            socket.emit(protoFS.WriteFile.RES, path);
            dataStream.end();
        });

        dataStream.on('error', function(err) {
            if (err) {
                console.log('WriteFile: ' + err);
                socket.emit(protoFS.WriteFile.ERR, path, SYSTEM.ERROR.FSIOError);
            }
        });

        /*
        fs.writeFile(path, data, function(err) {
            if (err) {
                console.log('WriteFile: ' + err);
                socket.emit(protoFS.WriteFile.ERR, path, SYSTEM.ERROR.FSIOError);
            }
        });
        */
    });

    ss(socket).on(protoFS.AppendFile.REQ, function(path, dataStream) {
        var realPath = security.getUserDataPath(path);

        if (fs.existsSync(realPath)) {
            var writeStream = fs.createWriteStream(realPath, {'flags': 'a'});
            dataStream.pipe(writeStream);

            dataStream.on('finish', function() {
                socket.emit(protoFS.AppendFile.RES, path);
                dataStream.end();
            });

            dataStream.on('error', function(err) {
                if (err) {
                    console.log('AppendFile: ' + err);
                    socket.emit(protoFS.AppendFile.ERR, path, SYSTEM.ERROR.FSIOError);
                }
            });
        }
        else
            socket.emit(protoFS.AppendFile.ERR, path, SYSTEM.ERROR.FSNotExist);

        /*
        if (fs.existsSync(realPath)) {
            fs.AppendFile(realPath, data, function(err) {
                if (err) {
                    console.log('AppendFile: ' + err);
                    socket.emit(protoFS.AppendFile.ERR, path, SYSTEM.ERROR.FSIOError);
                }
            });
        }
        else
            socket.emit(protoFS.AppendFile.ERR, path, SYSTEM.ERROR.FSNotExist);
        */
    });



    /**
     * Protocol Listener: File Handle Events
     */
    socket.on(protoFS.Open.REQ, function(path, flag, mode) {
        var realPath = security.getUserDataPath(path);

        if (fs.existsSync(realPath)) {
            fs.open(realPath, flag, mode, function(err, fd) {
                if (err) {
                    console.log('Open: ' + err);
                    socket.emit(protoFS.Open.ERR, path, SYSTEM.ERROR.FSIOERR);
                }
                else
                    socket.emit(protoFS.Open.RES, path, fd);
            });
        }
        else
            socket.emit(protoFS.Open.ERR, path, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.Close.REQ, function(fileHandle) {
        if (fileHandle) {
            fs.close(fileHandle, function(err) {
                if (err) {
                    console.log('Close: ' + err);
                    socket.emit(protoFS.Close.ERR, fileHandle, SYSTEM.ERROR.FSIOERR);
                }
                else
                    socket.emit(protoFS.Close.RES, fileHandle);
            });
        }
        else
            socket.emit(protoFS.Close.ERR, fileHandle, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.ReadData.REQ, function(fileHandle, offset, size) {
        if (fileHandle) {
            var buffer = new Buffer(size);
            fs.read(fileHandle, buffer, offset, size, 0, function(err, bytesRead, buffer) {
                if (err) {
                    console.log('ReadData: ' + err);
                    socket.emit(protoFS.ReadData.ERR, fileHandle, SYSTEM.ERROR.FSIOERR);
                }
                else {
                    socket.emit(protoFS.ReadData.RES, fileHandle, buffer, bytesRead);
                }
            });
        }
        else
            socket.emit(protoFS.ReadData.ERR, fileHandle, SYSTEM.ERROR.FSNotExist);
    });

    socket.on(protoFS.WriteData.REQ, function(fileHandle, offset, size, data) {
        if (fileHandle) {
            fs.write(fileHandle, data, offset, size, 0, function(err, written, buffer) {
                if (err) {
                    console.log('WriteData: ' + err);
                    socket.emit(protoFS.WriteData.ERR, fileHandle, SYSTEM.ERROR.FSIOERR);
                }
                else {
                    socket.emit(protoFS.WriteData.RES, fileHandle, written);
                }
            });
        }
        else
            socket.emit(protoFS.WriteData.ERR, fileHandle, SYSTEM.ERROR.FSNotExist);
    });
}

FileManager.prototype.unregister = function(socket, protoFS) {
    socket.removeAllListeners(protoFS.List.REQ);
    socket.removeAllListeners(protoFS.CreateFile.REQ);
    socket.removeAllListeners(protoFS.CreateDirectory.REQ);
    socket.removeAllListeners(protoFS.CreateHardLink.REQ);
    socket.removeAllListeners(protoFS.CreateSymbolicLink.REQ);
    socket.removeAllListeners(protoFS.Remove.REQ);
    socket.removeAllListeners(protoFS.Move.REQ);
    socket.removeAllListeners(protoFS.Copy.REQ);
    socket.removeAllListeners(protoFS.Exist.REQ);
    socket.removeAllListeners(protoFS.ReadFile.REQ);
    socket.removeAllListeners(protoFS.WriteFile.REQ);
    socket.removeAllListeners(protoFS.AppendFile.REQ);
    socket.removeAllListeners(protoFS.Open.REQ);
    socket.removeAllListeners(protoFS.Close.REQ);
    socket.removeAllListeners(protoFS.ReadData.REQ);
    socket.removeAllListeners(protoFS.WriteData.REQ);
}