"use strict";

const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const crypto = require('crypto');
const config = require('./config');

// var privatePem = fs.readFileSync(path.join(__dirname, '..', 'config/production/rsa_private_key.pem'));
// var publicPem = fs.readFileSync(path.join(__dirname, '..', 'config/production/rsa_public_key.pem'));
// var privateKey = privatePem.toString(); // 私钥
// var publicKey = publicPem.toString(); // 公钥

module.exports = {
    /**
     * 添加盐值的 md5 加密
     * @param userName
     * @param password
     * @returns {*}
     */
    hashCrypt(userName, password) {
        var saltPassword = userName + ':' + password;
        var md5 = crypto.createHash('md5');
        return md5.update(saltPassword).digest('hex');
    },
    /**
     * 获取随机盐值
     * @returns {string}
     */
    getRandomSalt() {
        return Math.random().toString().slice(2, 7);
    },
    /**
     * RSA 签名
     * @param encryptedPassword
     * @param machineCode
     * @returns {*}
     */
    rsaSign(encryptedPassword, machineCode) {
        var sign = crypto.createSign('RSA-SHA256');   // 创建签名
        sign.update(encryptedPassword + machineCode); // 利用签名更新数据
        return sign.sign(privateKey, 'hex');
    },
    /**
     * RSA 验证
     * @param encryptedPassword
     * @param sig
     * @returns {*}
     */
    rsaVerify(encryptedPassword, sig) {
        var verify = crypto.createVerify('RSA-SHA256');
        verify.update(encryptedPassword);
        return verify.verify(pubkey, sig, 'hex'); // true 为正确
    },
    /**
     * 异常处理
     * @param req
     * @param res
     * @param next
     */
    asyncMiddleware (fn) {
        // fn => (...args) => fn(...args).catch(args[2]);
    },
    /**
     *  从文件系统里重新获取文件
     */
    refresh: function () {
        fs.readdirSync(path.join(__dirname, "config", config.env)).filter(function (file) {
            return file.indexOf('.') !== 0;
        }).forEach(function (file) {
            if (file.slice(-5) === '.json') {
                config[path.basename(file, ".json")] = fs.readJsonSync(path.join(__dirname, "config", config.env, file), {throws: false});
            }
        });
    },
    /**
     * 根据 key 获取文件内容
     * @param key
     * @returns {tmp}
     */
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
    /**
     * 根据 key 设置文件内容
     * @param key
     * @param value
     * @returns {undefined}
     */
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