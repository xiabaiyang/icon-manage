"use strict";

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');

var config = {
    session_secret: '533aaaf35c5f55dd6b006f8b',
    auth_cookie_name: process.env.AUTH_COOKIE_NAME || 'secret',
    login_path: '/login',
    PROJECT_DIR: __dirname,
    env: process.env.NODE_ENV
};

function refresh() {
    fs.readdirSync(path.join(__dirname, "config", config.env)).filter(function (file) {
        return file.indexOf('.') !== 0;
    }).forEach(function (file) {
        if (file.slice(-5) === '.json') {
            config[path.basename(file, ".json")] = fs.readJsonSync(path.join(__dirname, "config", config.env, file), {throws: false});
        }
    });
}

refresh();

module.exports = {
    // 从文件系统里重新获取
    refresh: function () {
        refresh();
    },
    //使用 config.get('a.b.c');
    get: function (key) {
        if (typeof key !== "string") {
            return undefined;
        }
        let keys = key.split('.');
        let tmp = config;
        for (var i = 0; i < keys.length; i++) {
            if (_.has(tmp, keys[i])) {
                tmp = tmp[keys[i]];
                if (i === keys.length - 1) {
                    return tmp;
                }
            } else {
                return undefined;
            }
        }
    },
    //使用 config.set('a.b.c', {});
    set: function (key, value) {
        if (typeof key !== "string") {
            return undefined;
        }
        let keys = key.split('.');
        let tmp = config;
        for (var i = 0; i < keys.length; i++) {
            if (_.has(tmp, keys[i])) {
                if (i === keys.length - 1) {
                    tmp[keys[i]] = value;
                } else {
                    tmp = tmp[keys[i]];
                }
            } else {
                tmp[keys[i]] = {};
            }
        }
    }
};
