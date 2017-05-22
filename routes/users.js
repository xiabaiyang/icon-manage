// var express = require('express');
// var db = require('../models');
// var _ = require('lodash');
// var path = require('path');
// var config = require('../config/global.json');
//
// var router = express.Router();
//
// /* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'icon' });
// });
//
// module.exports = router;

var fs = require("fs");
var multer = require('multer');
var models = require('../models');
var express = require('express');
var router = express.Router();

var upload = multer({dest: '/tmp/'});
var SVGO = require('svgo');

var path = require('path');
var crypto = require('crypto');

router.post('/create', function (req, res) {
    models.User.create({
        username: req.body.username,
        password: req.body.password
    }).then(function () {
        res.redirect('/');
    });
});

router.get('/:user_id/destroy', function (req, res) {
    models.User.destroy({
        where: {
            id: req.params.user_id
        }
    }).then(function () {
        res.redirect('/');
    });
});

router.post('/:user_id/icons/create', function (req, res) {
    models.Icon.create({
        content: req.body.content,
        UserId: req.params.user_id
    }).then(function () {
        res.redirect('/');
    });
});

router.get('/:user_id/icons/:task_id/destroy', function (req, res) {
    models.Icon.destroy({
        where: {
            id: req.params.task_id
        }
    }).then(function () {
        res.redirect('/');
    });
});

router.post('/single_upload', function (req, res) {
    var reqParams = req.query;
    var sig = reqParams.sig;
    var svgName = reqParams.name;
    var svgContent = decodeURIComponent(reqParams.content);
    var svgo = new SVGO();
    if (svgContent == null || svgContent == undefined) {
        res.json({
            "status": 400,
            "msg": "上传文件错误"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        console.log('result:' + result[0].dataValues.id);
        if (result.length == 0) { // sig 错误
            var response = {
                "status": 400,
                "msg": 'sig 错误'
            };
            res.json(response);
        }
        else {
            var userId = result[0].dataValues.id;
            svgo.optimize(svgContent, function (result) {
                models.Icon.create({
                    name: svgName,
                    content: result.data,
                    UserId: userId
                }).then(function () {
                    var response = {
                        "status": 200,
                        "msg": 'success'
                    };
                    res.json(response);
                });
            });
        }
    });
});

router.post('/batch_upload', upload.array('image'), function (req, res) {
    var sig = req.query.sig;
    console.log('sig:' + sig);
    var uploadFileNum = req.files.length;
    var fileOriginalName = [];
    var svgo = new SVGO();
    if (uploadFileNum < 1) {
        res.json({
            "status": 400,
            "msg": "没有选择要上传的文件"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        console.log('查询 sig...' + result);
        if (result.length == 0) { // sig 错误
            var response = {
                "status": 400,
                "msg": 'sig 错误'
            };
            res.json(response);
        }
        else {
            var userId = result[0].dataValues.id;
            for (var i = 0; i < uploadFileNum; i++) {
                var count = 0; // 存储文件计数用
                (function (i) {
                    fileOriginalName[i] = req.files[i].originalname;

                    fs.readFile(req.files[i].path, 'utf8', function (err, data) {
                        if (err) {
                            res.json({
                                "status": 500,
                                "msg": '文件保存失败'
                            });
                        }
                        svgo.optimize(data, function (result) {
                            models.Icon.create({
                                name: fileOriginalName[i], // SVG 文件名
                                content: result.data, // SVG 文件内容
                                UserId: userId
                            }).then(function () {
                                // console.log('upload suc');
                            });

                            count++;

                            if (count === uploadFileNum) {
                                var response = {
                                    "status": 200,
                                    "msg": 'success'
                                };
                                res.json(response);
                            }
                        });
                    });
                })(i)
            }
        }
    });
});

router.get('/getFiles', function (req, res, next) {
    models.Icon.findAll({
        'attributes': ['name', 'content']
    })
    .then(function (result) {
        var files = [];
        for (var item in result) {
            files.push({
                name: result[item].dataValues.name,
                content: result[item].dataValues.content
            });
        }
        var response = {
            "status": 200,
            "msg": 'success',
            "data": files
        };
        res.json(response);
    });
});

// 用户注册
router.post('/register', function (req, res, next) {
    var params = req.body;
    var userName = params.userName;
    var password = params.password;
    // var machineCode = params.machineCode;
    var sig = params.sig;
    // var privatePem = fs.readFileSync(path.join(__dirname, '..', 'config/production/rsa_private_key.pem'));
    // var publicPem = fs.readFileSync(path.join(__dirname, '..', 'config/production/rsa_public_key.pem'));
    // var privateKey = privatePem.toString(); // 私钥
    // var publicKey = publicPem.toString(); // 公钥
    //加密

    /*
     * 添加盐值的 md5 加密
     * */
    function hashCrypt(userName, password) {
        var saltPassword = userName + ':' + password;
        var md5 = crypto.createHash('md5');
        return md5.update(saltPassword).digest('hex');
    }

    /*
     * 获取随机盐值
     * */
    function getRandomSalt() {
        return Math.random().toString().slice(2, 7);
    }

    function rsaSign(encryptedPassword, machineCode) {
        var sign = crypto.createSign('RSA-SHA256'); // 创建签名
        sign.update(encryptedPassword + machineCode); // 利用签名更新数据
        return sign.sign(privateKey, 'hex');
    }

    function rsaVerify(encryptedPassword, sig) {
        var verify = crypto.createVerify('RSA-SHA256');
        verify.update(encryptedPassword);
        return verify.verify(pubkey, sig, 'hex'); // true 为正确
    }

    /*
    * 1. 第一次登录时,需要根据 userName 和 password 去更新 machineCode
    * 2. 除第一次登录时,先利用 sig 解出 userName
    * 3. 用户更换 machineCode 登录时,需要添加新记录
    * */
    if (userName && password && (!sig)) {
        models.User.findAll({
            where: {
                userName: userName
            }
        }).then(function (result) {
            if (result.length > 0) { // 用户已存在
                var response = {
                    "status": 400,
                    "msg": '用户已存在'
                };
                res.json(response);
            }
            else { // 创建新用户
                var encryptedPassword = hashCrypt(userName, password); // 加密的 password
                models.User.create({
                    userName: userName,
                    encryptedPassword: encryptedPassword
                }).then(function () {
                    var response = {
                        "status": 200,
                        "msg": 'succ'
                    };
                    res.json(response);
                });
            //     var encryptedPassword = hashCrypt(userName, password); // 加密的 password
            //     var sig = rsaSign(encryptedPassword, machineCode); // 签名
            //     for (var item in result) {
            //         if (!result[item].dataValues.encryptedPassword) { // encryptedPassword 为空时
            //             models.User.update({
            //                 encryptedPassword: encryptedPassword,
            //                 machineCode: machineCode,
            //                 sig: sig
            //             }, {
            //                 where: {
            //                     userName: userName
            //                 }
            //             }).then(function () {});
            //
            //             var response = {
            //                 "status": 200,
            //                 "msg": 'success',
            //                 "sig": sig
            //             };
            //             res.json(response);
            //         }
            //         else if (encryptedPassword === result[item].dataValues.encryptedPassword){ // encryptedPassword 存在时
            //             var response = {
            //                 "status": 200,
            //                 "msg": 'success',
            //                 "sig": sig
            //             };
            //             res.json(response);
            //         }
            //         else {
            //             var response = {
            //                 "status": 400,
            //                 "msg": 'fail'
            //             };
            //             res.json(response);
            //         }
            //     }
            }
        });
    }
    else if (sig && (!userName) && (!password)) { // 通过 sig 直接登录
        models.User.findAll({
                where: {
                    machineCode: machineCode
                }
            })
            .then(function (result) {
                if (rsaSign(result[0].dataValues.encryptedPassword, machineCode) === sig) { // 机器码是唯一的
                    console.log('合法用户');
                    var response = {
                        "status": 200,
                        "msg": 'success',
                        "sig": sig
                    };
                    res.json(response);
                }
                else {
                    console.log('非法用户');
                    var response = {
                        "status": 400,
                        "msg": 'fail'
                    };
                    res.json(response);
                }
                // if (result) {
                // }
                // else { // 如果该用户不存在,则创建
                //     models.User.create({
                //         userName: userName,
                //         encryptedPassword: '',
                //         machineCode: '',
                //         sig: ''
                //     }).then(function () {
                //         console.log('register suc');
                //     });
                // }
            });
    }
});

// 用户登录
router.get('/login', function (req, res, next) {
    var params = req.query;
    var userName = params.userName;
    var password = params.password;
    var sig = params.sig;

    /*
     * 添加盐值的 md5 加密
     * */
    function hashCrypt(userName, password) {
        var saltPassword = userName + ':' + password;
        var md5 = crypto.createHash('md5');
        return md5.update(saltPassword).digest('hex');
    }

    if (userName && password && (!sig)) {
        models.User.findAll({
            where: {
                userName: userName
            }
        }).then(function (result) {
            if (result.length == 0) { // 用户不存在
                var response = {
                    "status": 400,
                    "msg": '用户不存在'
                };
                res.json(response);
            }
            else { // 用户存在
                var sig = result[0].dataValues.encryptedPassword;
                if (hashCrypt(userName, password) == sig) { // 密码正确
                    var response = {
                        "status": 200,
                        "msg": '登录成功',
                        sig: sig
                    };
                    res.json(response);
                }
                else { // 密码错误
                    var response = {
                        "status": 400,
                        "msg": '密码错误'
                    };
                    res.json(response);
                }
            }
        });
    }

});

// 用户登出
router.get('/logout', function (req, res, next) {
});

module.exports = router;
