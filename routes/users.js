var fs = require("fs");
var multer = require('multer');
var models = require('../models');
var express = require('express');
var sequelize = require('sequelize');
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
                "msg": 'sig 错误'
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

router.post('/batch_upload', upload.array('image'), function (req, res) {
    var sig = req.query.sig;
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
                                name: fileOriginalName[i], // SVG 文件名
                                author: 'maybexia', // 默认作者
                                online: false, // 预览版本默认是下线
                                content: result.data, // SVG 文件内容
                                projectId: 0, // 0 表示图标是预览版本的项目 ID
                                categoryId: 0, // 0 表示图标是预览版本的分类 ID
                                UserId: userId,
                                remarks: '',
                                version: 0, // 默认版本 0
                                experienceVersion: true
                            }).then(function () {
                                // console.log('upload suc');
                            });

                            count++;

                            if (count === uploadFileNum) {
                                res.json({
                                    "status": 200,
                                    "msg": 'success'
                                });
                            }
                        });
                    });
                })(i)
            }
        }
    });
});

router.post('/getFiles', function (req, res, next) {
    models.Icon.findAll({
        attributes: ['name', 'content'],
        where: {
            experienceVersion: true
        }
    })
    .then(function (result) {
        var files = [];
        for (var item in result) {
            files.push({
                name: result[item].dataValues.name,
                content: result[item].dataValues.content
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
    if (userName && password) {
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
                    encryptedPassword: encryptedPassword
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
                        "sig": sig
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
    else if(sig) {
        models.User.findAll({
            where: {
                encryptedPassword: sig
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
                var response = {
                    "status": 200,
                    "msg": '登录成功',
                    sig: sig
                };
                res.json(response);
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

// 用户登出
// router.get('/logout', function (req, res, next) {
// });


// 新建项目
router.post('/createProject', function (req, res, next) {
    var sig = req.body.sig;
    var proName = req.body.projectname;
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
            models.Project.create({
                proName: proName,
                ownerId: result[0].dataValues.id,
                ownerName: result[0].dataValues.userName
            }).then(function (data) {
                var response = {
                    "status": 200,
                    "msg": 'succ',
                    "projectId": data.dataValues.id
                };
                res.json(response);
            });
        }
    });
});

// 新建分类
router.post('/createCategory', function (req, res, next) {
    var projectId = req.body.projectid;
    var categoryName = req.body.categoryname;
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
                ProjectId: projectId
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
});

// 项目添加成员
router.post('/addMember', function (req, res, next) {
    var projectId = req.body.project;
    var memberSig = req.body.sig; // 被添加人的标识
    models.Project.findAll({
        where: {
            id: projectId
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
            var projectName = project[0].dataValues.proName;
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
});

// 查询项目+分类
router.post('/queryProject', function (req, res, next) {
    var sig = req.body.sig;
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
            models.Project.findAll({
                where: {
                    ownerId: userId
                }
            }).then(function (data) {

                if (data.length == 0) {
                    var response = {
                        "status": 200,
                        "msg": 'succ',
                        "list": []
                    };
                    res.json(response);
                }
                else {
                    var list = []; // 返回列表
                    data.forEach(function (value, index, array) {
                        var projectId = value.dataValues.id;
                        var projectName = value.dataValues.proName;

                        models.Category.findAll({
                            where: {
                                ProjectId: projectId
                            }
                        }).then(function (categorys) {
                            var categoryList = categorys.map(function (categoryItem) {
                                return {
                                    categoryId: categoryItem.dataValues.id,
                                    categoryName: categoryItem.dataValues.categoryName
                                }
                            });

                            list.push({
                                projectId: projectId,
                                projectName: projectName,
                                categoryList: categoryList
                            });

                            if (index == array.length -1) {
                                var response = {
                                    "status": 200,
                                    "msg": 'succ',
                                    "list": list
                                };
                                res.json(response);
                            }
                        });
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
                attributes: ['name', 'content', [sequelize.fn('MAX', sequelize.col('version')), 'curVersion']],
                group: 'name',
                where: {
                    projectId: projectId,
                    experienceVersion: false
                }
            }).then(function (result) {
                if (result.length == 0) {
                    var response = {
                        "status": 200,
                        "msg": '该项目暂无图标'
                    };
                    res.json(response);
                }
                else {
                    var iconList = [];
                    for (var item in result) {
                        iconList.push({
                            name: result[item].dataValues.name,
                            content: result[item].dataValues.content
                        });
                    }
                    var response = {
                        "status": 200,
                        "msg": 'succ',
                        "list": iconList
                    };
                    res.json(response);
                }
            });
        }
    });
});

// 根据 categoryId 查询 icon
router.post('/queryIconByCateId', function (req, res, next) {
    var categoryId = req.body.categoryid;
    var sig = req.body.sig;

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
                attributes: ['name', 'content', [sequelize.fn('MAX', sequelize.col('version')), 'curVersion']],
                group: 'name',
                where: {
                    categoryId: categoryId,
                    experienceVersion: false
                }
            }).then(function (result) {
                if (result.length == 0) {
                    var response = {
                        "status": 200,
                        "msg": '该分类暂无图标'
                    };
                    res.json(response);
                }
                else {
                    var iconList = [];
                    for (var item in result) {
                        iconList.push({
                            name: result[item].dataValues.name,
                            content: result[item].dataValues.content
                        });
                    }
                    var response = {
                        "status": 200,
                        "msg": 'succ',
                        "list": iconList
                    };
                    res.json(response);
                }
            });
        }
    });
});

// 根据 sig 查询用户所有项目的图标 TODO
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


module.exports = router;
