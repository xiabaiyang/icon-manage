var fs = require("fs");
var multer = require('multer');
var models = require('../models');
var express = require('express');
var sequelize = require('sequelize');
var async = require('async');
var rimraf = require('rimraf');
var router = express.Router();

var upload = multer({dest: '/tmp/'});
var SVGO = require('svgo');

var path = require('path');
var crypto = require('crypto');
var AdmZip = require('adm-zip');

const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');


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

// 单个文件上传,后续去除
router.post('/single_upload', function (req, res) {
    var reqParams = req.body;
    var sig = reqParams.sig;
    var svgName = reqParams.name;
    var categoryId = reqParams.categoryid;
    var projectId = reqParams.projectid;
    var remarks = reqParams.remarks;
    var author = reqParams.author;
    var version = 1; // 默认是 1
    var svgContent = decodeURIComponent(reqParams.content);
    var svgo = new SVGO();

    if (!sig || !svgName || !categoryId || !projectId || !remarks || !author || !svgContent) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

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
        if (result.length == 0) { // sig 错误
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            var userId = result[0].dataValues.id;

            // 确定上传图标是否已经存在
            models.Icon.findAll({
                where: {
                    UserId: userId,
                    name: svgName
                }
            }).then(function(icons) { // 已经存在，找该图标当前版本号最大的值
                if (icons.length > 0) {
                    console.log('updating start');
                    // 旧版本全部下线
                    models.Icon.update({ online: false }, {
                        where: {
                            UserId: userId,
                            name: svgName
                        }
                    }).then(function (){
                        models.Icon.max('version', {
                            where: {
                                UserId: userId,
                                name: svgName
                            }
                        }).then(function(max) {
                            svgo.optimize(svgContent, function (result) {
                                models.Icon.create({
                                    name: svgName,
                                    author: author,
                                    online: true, // 上传默认图标上线
                                    content: result.data,
                                    projectId: projectId,
                                    categoryId: categoryId,
                                    UserId: userId,
                                    remarks: remarks,
                                    version: max + 1, // 在当前版本号基础上加 1
                                    experienceVersion: false
                                }).then(function () {
                                    res.json({
                                        "status": 200,
                                        "msg": 'success'
                                    });
                                });
                            });
                        });
                    });
                }
                else { // 新图标
                    svgo.optimize(svgContent, function (result) {
                        models.Icon.create({
                            name: svgName,
                            author: author,
                            online: true, // 首次上传默认图标上线
                            content: result.data,
                            projectId: projectId,
                            categoryId: categoryId,
                            UserId: userId,
                            remarks: remarks,
                            version: 1, // 初次上传版本号默认为 1
                            experienceVersion: false
                        }).then(function () {
                            res.json({
                                "status": 200,
                                "msg": 'success'
                            });
                        });
                    });
                }
            });
        }
    });
});

/**
 * 检测图标的版本号
 */
router.post('/version_check', function (req, res) {
    var reqParams = req.body;
    var sig = reqParams.sig;
    var projectId = reqParams.projectid;
    var svgList = JSON.parse(reqParams.list);

    if (!sig || !svgList || !projectId) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) { // sig 错误
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            var userId = result[0].dataValues.id;
            var list = [];
            async.each(svgList, function (item, callback) {
                var svgName = decodeURIComponent(item);
                // 确定上传图标是否已经存在,而且必须是 online 版本
                models.Icon.findAll({
                    where: {
                        UserId: userId,
                        name: svgName,
                        projectId: projectId,
                        online: true
                    }
                }).then(function(icons) {
                    // 已经存在,返回当前版本号,不存在,返回版本号为 0,方便后续覆盖
                    list.push({
                        svgName: svgName,
                        version: icons.length == 1 ? icons[0].dataValues.version : 0
                    });
                    callback();
                });
            }, function (err) {
                if(err) {
                    res.json({
                        "status": 400,
                        "msg": 'fail'
                    });
                } else {
                    res.json({
                        "status": 200,
                        "msg": 'success',
                        "list": list
                    });
                }
            });
        }
    });
});

// 批量上传
router.post('/batch_upload', function (req, res) {
    var sig = req.body.sig;
    var svgList = JSON.parse(req.body.list);
    var uploadFileNum = svgList.length;
    var svgo = new SVGO();

    if (!sig || !svgList) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

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
        // 验证 sig
        if (result.length == 0) { // sig 错误
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            var userId = result[0].dataValues.id;
            async.each(svgList, function (svgItem, callback) {
                svgItem.name = decodeURIComponent(svgItem.name);
                svgItem.content = decodeURIComponent(svgItem.content);
                if (!svgItem.name || !svgItem.content || !svgItem.projectId || !svgItem.categoryId) {
                    callback('参数错误');
                }
                else {
                    // 服务器去数据库查该图标的所有版本
                    models.Icon.findAll({
                        where: {
                            name: svgItem.name,
                            projectId: svgItem.projectId
                        }
                    }).then(function (icon) {
                        if (icon.length != 0) {
                            // 找到最新线上版本
                            models.Icon.findOne({
                                where: {
                                    name: svgItem.name,
                                    projectId: svgItem.projectId,
                                    online: true
                                }
                            }).then(function (item) {
                                // 之前有该图标,则旧版本先下线,再插入新版本
                                models.Icon.update({ online: false }, {
                                    where: {
                                        name: icon[0].dataValues.name,
                                        projectId: icon[0].dataValues.projectId
                                    }
                                }).then(function () {
                                    svgo.optimize(svgItem.content, function (svg) {
                                        models.Icon.create({
                                            name: svgItem.name,
                                            author: svgItem.author,
                                            online: true, // 上传默认图标上线
                                            content: svg.data,
                                            projectId: svgItem.projectId,
                                            categoryId: svgItem.categoryId,
                                            UserId: userId,
                                            remarks: svgItem.remarks,
                                            version: item.dataValues.version + 1,
                                            experienceVersion: false
                                        }).then(function () {
                                            callback();
                                        });
                                    });
                                });
                            });
                        }
                        else {
                            // 之前没有该图标,直接插入
                            svgo.optimize(svgItem.content, function (svg) {
                                models.Icon.create({
                                    name: svgItem.name,
                                    author: svgItem.author,
                                    online: true, // 上传默认图标上线
                                    content: svg.data,
                                    projectId: svgItem.projectId,
                                    categoryId: svgItem.categoryId,
                                    UserId: userId,
                                    remarks: svgItem.remarks,
                                    version: 1,
                                    experienceVersion: false
                                }).then(function () {
                                    callback();
                                });
                            });
                        }
                    });
                }
            }, function (err) {
                if (err) {
                    res.json({
                        "status": 400,
                        "msg": err
                    });
                }
                else {
                    res.json({
                        "status": 200,
                        "msg": 'success'
                    });
                }
            });
        }
    });
});

// 旧版本的批量上传
router.post('/upload', upload.array('image'), function (req, res) {
    var sig = req.query.sig;
    var author = req.query.author;
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
        console.log('查询结果...' + result);
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
                                name: fileOriginalName[i], 
                                author: author,
                                online: true,
                                content: result.data,
                                projectId: 1,
                                categoryId: 1,
                                UserId: userId,
                                remarks: '',
                                version: 1,
                                experienceVersion: true
                            }).then(function () {
                                count++;

                                if (count === uploadFileNum) {
                                    res.json({
                                        "status": 200,
                                        "msg": 'success'
                                    });
                                }
                            });
                        });
                    });
                })(i)
            }
        }
    });
});

router.post('/getFiles', function (req, res, next) {
    models.Icon.findAll({
        attributes: ['name', 'content', 'author'],
        where: {
            experienceVersion: true
        }
    })
    .then(function (result) {
        var files = [];
        for (var item in result) {
            files.push({
                name: result[item].dataValues.name,
                content: result[item].dataValues.content,
                author: result[item].dataValues.author
            });
        }
        res.json({
            "status": 200,
            "msg": 'success',
            "data": files
        });
    });
});

// 用户注册
router.post('/register', function (req, res, next) {
    var params = req.body;
    var userName = params.username;
    var password = params.password;
    var mail = params.mail;
    // var machineCode = params.machineCode;
    // var sig = params.sig;
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
    if (userName && password && mail) {
        models.User.findAll({
            where: {
                userName: userName
            }
        }).then(function (result) {
            if (result.length > 0) { // 用户已存在
                res.json({
                    "status": 400,
                    "msg": '用户名已存在'
                });
            }
            else { // 创建新用户
                var encryptedPassword = hashCrypt(userName, password); // 加密的 password
                models.User.create({
                    userName: userName,
                    encryptedPassword: encryptedPassword,
                    mail: mail
                }).then(function (user) {
                    res.json({
                        "status": 200,
                        "sig": user.dataValues.encryptedPassword,
                        "msg": 'succ'
                    });
                });
            }
        });
    }
    else {
        res.json({
            "status": 400,
            "msg": 'params error'
        });
    }
});

// 用户登录
router.post('/login', function (req, res, next) {
    var params = req.body;
    var userName = params.username;
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

    if (userName && password) {
        models.User.findAll({
            where: {
                userName: userName
            }
        }).then(function (result) {
            if (result.length == 0) { // 用户不存在
                res.json({
                    "status": 400,
                    "msg": '用户不存在'
                });
            }
            else { // 用户存在
                var sig = result[0].dataValues.encryptedPassword;
                if (hashCrypt(userName, password) == sig) { // 密码正确
                    res.json({
                        "status": 200,
                        "msg": '登录成功',
                        "sig": sig
                    });
                }
                else { // 密码错误
                    res.json({
                        "status": 400,
                        "msg": '密码错误'
                    });
                }
            }
        });
    }
    else if(sig) {
        models.User.findAll({
            where: {
                encryptedPassword: sig
            }
        }).then(function (result) {
            if (result.length == 0) { // 用户不存在
                res.json({
                    "status": 400,
                    "msg": '用户不存在'
                });
            }
            else { // 用户存在
                res.json({
                    "status": 200,
                    "msg": '登录成功',
                    sig: sig
                });
            }
        });
    }
    else {
        res.json({
            "status": 400,
            "msg": '参数错误'
        })
    }
});

// 新建项目
router.post('/createProject', function (req, res, next) {
    var sig = req.body.sig;
    var proName = req.body.projectname;

    if (!sig || !proName) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            var userId = result[0].dataValues.id;
            var invitedKey = Math.random().toString(36).slice(2, 10).toUpperCase(); // 随机邀请码
            models.Project.create({
                proName: proName,
                ownerId: result[0].dataValues.id,
                ownerName: result[0].dataValues.userName,
                invitedKey: invitedKey,
                online: true // 后续可能需要对项目进行判重
            }).then(function (data) {
                // 创建项目后,自己自动加入该项目
                models.ProjectMember.create({
                    ProjectId: data.dataValues.id,
                    UserId: userId
                }).then(function (result) {
                    res.json({
                        "status": 200,
                        "msg": 'succ',
                        "projectId": data.dataValues.id,
                        "invitedKey": invitedKey
                    });
                });
            });
        }
    });
});

// 删除项目(下线)
router.post('/deleteProject', function (req, res, next) {
    var sig = req.body.sig;
    var proName = req.body.projectname;

    if (!sig || !proName) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            models.Project.findOne({
                where: {
                    proName: proName
                }
            }).then(function (result) {
                if (result) {
                    models.Project.update({ online: false }, {
                        where: {
                            proName: proName
                        }
                    }).then(function () {
                        res.json({
                            "status": 200,
                            "msg": 'succ'
                        });
                    });
                }
                else {
                    res.json({
                        "status": 400,
                        "msg": '项目不存在'
                    });
                }
            });
        }
    });
});

// 新建分类
router.post('/createCategory', function (req, res, next) {
    var sig = req.body.sig;
    var projectId = req.body.projectid;
    var categoryName = req.body.categoryname;

    if (!sig || !projectId || !categoryName) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            models.Project.findAll({
                where: {
                    id: projectId
                }
            }).then(function (result) {
                if (result.length == 0) {
                    var response = {
                        "status": 400,
                        "msg": '项目不存在'
                    };
                    res.json(response);
                }
                else {
                    var projectId = result[0].dataValues.id;
                    models.Category.create({
                        categoryName: categoryName,
                        ProjectId: projectId,
                        online: true // 后续可能需要对类目进行判重
                    }).then(function (data) {
                        var response = {
                            "status": 200,
                            "msg": 'succ',
                            "categoryId": data.dataValues.id
                        };
                        res.json(response);
                    });
                }
            });
        }
    });
});

// 删除分类(下线)
router.post('/deleteCategory', function (req, res, next) {
    var sig = req.body.sig;
    var cateName = req.body.categoryname;

    if (!sig || !cateName) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            models.Category.findOne({
                where: {
                    categoryName: cateName
                }
            }).then(function (result) {
                if (result) {
                    models.Category.update({ online: false }, {
                        where: {
                            categoryName: cateName
                        }
                    }).then(function () {
                        res.json({
                            "status": 200,
                            "msg": 'succ'
                        });
                    });
                }
                else {
                    res.json({
                        "status": 400,
                        "msg": '类目不存在'
                    });
                }
            });
        }
    });
});

// 项目添加成员
router.post('/addMember', function (req, res, next) {
    // var projectId = req.body.projectid;
    var invitedKey = req.body.key; // 项目邀请码
    var memberSig = req.body.sig; // 被添加人的标识

    if (!invitedKey || !memberSig) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.Project.findAll({
        where: {
            invitedKey: invitedKey
        }
    }).then(function (project) {
        if (project.length == 0) {
            var response = {
                "status": 400,
                "msg": '项目不存在'
            };
            res.json(response);
        }
        else {
            var projectId = project[0].dataValues.id;
            models.User.findAll({
                where: {
                    encryptedPassword: memberSig
                }
            }).then(function (user) {
                if (user.length == 0) {
                    var response = {
                        "status": 400,
                        "msg": '成员不存在'
                    };
                    res.json(response);
                }
                else {
                    var userId = user[0].dataValues.id;

                    // 确认成员是否已经加入该项目
                    models.ProjectMember.findAll({
                        where: {
                            UserId: userId,
                            ProjectId: projectId
                        }
                    }).then(function (user) {
                        if (user.length != 0) {
                            var response = {
                                "status": 400,
                                "msg": '成员已加入该项目'
                            };
                            res.json(response);
                        }
                        else {
                            models.ProjectMember.create({
                                ProjectId: projectId,
                                UserId: userId
                            }).then(function (result) {
                                var response = {
                                    "status": 200,
                                    "msg": 'succ'
                                };
                                res.json(response);
                            });
                        }
                    });
                }
            });
        }
    });
});

// 查询项目+分类
router.post('/queryProject', function (req, res, next) {
    var sig = req.body.sig;

    if (!sig) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            var userId = result[0].dataValues.id;
            // 自己创建或者加入的项目,都需要可见
            models.ProjectMember.findAll({
                where: {
                    UserId: userId
                }
            }).then(function (projects) {
                var list = []; // 返回列表
                if (projects.length == 0) {
                    res.json({
                        "status": 200,
                        "msg": 'succ',
                        "list": list
                    });
                    return -1;
                }
                else {
                    async.each(projects, function (projectItem, callback) {
                        models.Project.findAll({
                            where: {
                                id: projectItem.dataValues.projectId,
                                online: true
                            }
                        }).then(function (data) {
                            if (data.length != 0) {
                                data.forEach(function (value, index, array) {
                                    var projectId = value.dataValues.id;
                                    var projectName = value.dataValues.proName;
                                    var invitedKey = value.dataValues.invitedKey;

                                    models.Category.findAll({
                                        where: {
                                            ProjectId: projectId,
                                            online: true
                                        }
                                    }).then(function (categorys) {
                                        if (categorys.length != 0) {
                                            var categoryList = categorys.map(function (categoryItem) {
                                                return {
                                                    categoryId: categoryItem.dataValues.id,
                                                    categoryName: categoryItem.dataValues.categoryName
                                                }
                                            });
                                            list.push({
                                                projectId: projectId,
                                                projectName: projectName,
                                                invitedKey: invitedKey,
                                                categoryList: categoryList
                                            });
                                        }
                                        else {
                                            list.push({
                                                projectId: projectId,
                                                projectName: projectName,
                                                invitedKey: invitedKey,
                                                categoryList: []
                                            });
                                        }
                                        callback();
                                    });
                                });
                            }
                            else {
                                callback();
                            }
                        });
                    }, function (err) {
                        console.log(list);
                        if (err) {
                            res.json({
                                "status": 400,
                                "msg": err
                            });
                        }
                        else {
                            res.json({
                                "status": 200,
                                "msg": 'succ',
                                "list": list
                            });
                        }
                    });
                }
            });
        }
    });
});

// 根据 projectId 查询 icon
router.post('/queryIconByProId', function (req, res, next) {
    var projectId = req.body.projectid;
    var sig = req.body.sig;

    if (!projectId || !sig) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    // sig 验证
    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (user) {
        if (user.length == 0) { // 用户不存在
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            // 相同 name 的图标返回当前 version 最大的那个
            models.Icon.findAll({
                where: {
                    projectId: projectId,
                    online: true,
                    experienceVersion: false
                }
            }).then(function (result) {
                console.log('result.length:');
                console.log(result.length);

                console.log('result:');
                console.log(result);

                if (result.length == 0) {
                    res.json({
                        "status": 200,
                        "msg": '该项目暂无图标'
                    });
                }
                else {
                    var iconList = [];
                    for (var item in result) {
                        var value = result[item].dataValues;
                        iconList.push({
                            name: value.name,
                            author: value.author,
                            content: value.content,
                            projectId: value.projectId,
                            categoryId: value.categoryId,
                            remarks: value.remarks,
                            version: value.curVersion
                        });
                    }
                    console.log('iconList:');
                    console.log(iconList);

                    res.json({
                        "status": 200,
                        "msg": 'succ',
                        "list": iconList
                    });
                }
            });
        }
    });
});

// 根据 categoryId 查询 icon
router.post('/queryIconByCateId', function (req, res, next) {
    var projectId = req.body.projectid;
    var categoryId = req.body.categoryid;
    var sig = req.body.sig;

    if (!categoryId || !sig) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    // sig 验证
    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (user) {
        if (user.length == 0) {
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            models.Icon.findAll({
                where: {
                    categoryId: categoryId,
                    projectId: projectId,
                    online: true,
                    experienceVersion: false
                }
            }).then(function (result) {
                if (result.length == 0) {
                    res.json({
                        "status": 200,
                        "msg": '该分类暂无图标'
                    });
                }
                else {
                    var iconList = [];
                    for (var item in result) {
                        var value = result[item].dataValues;
                        iconList.push({
                            name: value.name,
                            author: value.author,
                            content: value.content,
                            projectId: value.projectId,
                            categoryId: value.categoryId,
                            remarks: value.remarks,
                            version: value.curVersion
                        });
                    }
                    res.json({
                        "status": 200,
                        "msg": 'succ',
                        "list": iconList
                    });
                }
            });
        }
    });
});

// 根据 sig 查询用户所有项目的图标
router.post('/queryIconBySig', function (req, res, next) {
    models.User.findAll({
        where: {
            encryptedPassword: req.body.sig
        }
    }).then(function(result) {
        if (result.length == 0) {
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            models.Icon.findAll({
                where: {
                    UserId: result[0].dataValues.id,
                    experienceVersion: false
                }
            }).then(function(icons) {
                var iconList = [];
                for (var item in icons) {
                    iconList.push({
                        name: icons[item].dataValues.name,
                        content: icons[item].dataValues.content
                    });
                }
                res.json({
                    "status": 200,
                    "msg": 'succ',
                    "list": iconList
                });  
            });
        }
    });
});

// 提示图标是否存在，返回值： 1. 是否存在（project）2. 某个不同于他想上传分类已经存在，old_catgeoryname
router.post('/svgExist', function (req, res, next) {
    var svgName = req.body.svgname;
    var projectId = req.body.projectid;

    if (!svgName || !projectId) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.Icon.findAll({
        where: {
            name: svgName,
            projectId: projectId,
            online: true
        }
    }).then(function (result) {
        if (result.length == 0) { // 图标不存在
            res.json({
                "status": 200,
                "code": 0
            }); 
        }
        else {
            res.json({
                "status": 200,
                "code": 1, 
                "categoryid": result[0].dataValues.categoryId
            }); 
        }
    });
});

router.post('/uploadHtml', upload.single('image'), function (req, res , next) {
    var randomDir = Math.random().toString(36).slice(2, 8);
    var destination = '/var/www/html/' + randomDir + '/' + req.file.originalname;
    var zip = new AdmZip(req.file.path);

    try {
        zip.extractAllTo('/var/www/html/' + randomDir + '/', true);
        imagemin([destination + '/*.{jpg,png}'], 'build/images', {
            plugins: [
                imageminJpegtran(),
                imageminPngquant({quality: '65-80'})
            ]
        }).then(function (files) {
            res.json({
                "status": 200,
                "msg": '解压完成',
                "fileName": req.file.originalname,
                "dir": randomDir
            });
        });
    } catch(err) {
        console.log(err);
        res.json({
            "status": 400,
            "msg": '解压失败'
        });
    }
});

/**
 * 删除上传文件夹
 */
router.post('/deleteHtml', function (req, res , next) {
    var dirName = req.body.dirname;
    var rootDir = '/var/www/html/';

    if (!dirName) {
        res.json({
            "status": 400,
            "msg": '参数错误'
        });
    }

    fs.exists(rootDir + dirName, function (exists) {
        if (exists) {
            rimraf(rootDir + dirName, function (err) {
                if (!err) {
                    res.json({
                        "status": 200,
                        "msg": '删除成功'
                    });
                } else {
                    console.log('err:' + err);
                    res.json({
                        "status": 500,
                        "msg": '删除失败'
                    });
                }
            });
            console.log('end');
        } else {
            res.json({
                "status": 400,
                "msg": '文件夹不存在'
            });
        }
    });
});

// 根据图标 name 查询所有版本的图标信息
router.post('/queryIconByName', function (req, res, next) {
    var reqParams = req.body;
    var sig = reqParams.sig;
    var svgName = reqParams.name;
    var projectId = reqParams.projectid;

    if (!sig || !svgName || !projectId) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function(user) {
        if (user.length == 0) { // 用户不存在
            res.json({
                "status": 400,
                "msg": '用户不存在'
            });
        }
        else {
            var userId = user[0].dataValues.id;
            models.Icon.findAll({
                where: {
                    UserId: userId,
                    projectId: projectId,
                    name: svgName
                }
            }).then(function (result) {
                console.log(result);
                if (result.length == 0) {
                    res.json({
                        "status": 400,
                        "msg": '图标不存在'
                    });
                }
                else {
                    var iconList = [];
                    for (var item in result) {
                        var value = result[item].dataValues;
                        iconList.push({
                            name: value.name,
                            author: value.author,
                            content: value.content,
                            projectId: value.projectId,
                            categoryId: value.categoryId,
                            remarks: value.remarks,
                            version: value.version
                        });
                    }
                    res.json({
                        "status": 200,
                        "msg": 'succ',
                        "list": iconList
                    });
                }
            });
        }
    });
});

// 刷新邀请码
router.post('/refreshKey', function (req, res, next) {
    var reqParams = req.body;
    var sig = reqParams.sig;
    var projectId = reqParams.projectid;

    if (!sig || !projectId) {
        res.json({
            "status": 400,
            "msg": "缺少参数"
        });
        return -1;
    }

    models.User.findAll({
        where: {
            encryptedPassword: sig
        }
    }).then(function (result) {
        if (result.length == 0) {
            var response = {
                "status": 400,
                "msg": '用户不存在'
            };
            res.json(response);
        }
        else {
            var newInvitedKey = Math.random().toString(36).slice(2, 10).toUpperCase(); // 随机邀请码

            models.Project.update({ invitedKey: newInvitedKey }, {
                where: {
                    id: projectId
                }
            }).then(function (result) {
                res.json({
                    "status": 200,
                    "msg": 'succ',
                    "invitedKey": newInvitedKey
                });
            });
        }
    });
});

module.exports = router;
