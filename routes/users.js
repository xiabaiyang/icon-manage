const fs = require("fs");
const path = require('path');
const multer = require('multer');
const express = require('express');
const sequelize = require('sequelize');
const async = require('async');
const rimraf = require('rimraf');
const HttpStatus = require('http-status-codes');
const upload = multer({dest: '/tmp/'});
const SVGO = require('svgo');
const AdmZip = require('adm-zip');
const pfs = require("pn/fs");
const svg2png = require("svg2png");
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');

const models = require('../models');
const util = require('../util');
const config = require('../config');

const router = express.Router();

/**
 * 检测图标的版本号
 */
router.post('/version_check', async (req, res, next) => {
    let reqParams = req.body;
    let sig = reqParams.sig;
    let projectId = reqParams.projectid;
    let svgNameList = JSON.parse(reqParams.list);
    let status = HttpStatus.OK;
    let msg = '';
    let list = [];

    if (!sig || !svgNameList || !projectId) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (user) {
            for (let value of svgNameList) {
                let svgName = decodeURIComponent(value);
                // 确定上传图标是否已经存在,而且必须是 online 版本
                let icon = await models.Icon.findOne({
                    where: {
                        UserId: user.id,
                        name: svgName,
                        projectId: projectId,
                        online: true
                    }
                });
                // 已经存在,返回当前版本号,不存在,返回版本号为 0,方便后续覆盖
                list.push({
                    id: icon ? icon.id : -1,
                    svgName: svgName,
                    version: icon ? icon.version : 0
                });
            }

            msg = config.msg_type.SUCCESS;
        } else {
            msg = config.msg_type.USER_NOT_EXIST;
        }
    }

    res.json({
        status,
        msg,
        list
    });
});

/**
 * 批量上传
 */
router.post('/batch_upload', async (req, res, next) => {
    let sig = req.body.sig;
    let svgList = JSON.parse(req.body.list);
    let uploadFileNum = svgList.length;
    let svgo = new SVGO();
    let status = HttpStatus.OK;
    let msg = '';

    if (svgList) {
        // 参数不对，统一不做处理
        for (let svgItem of svgList) {
            if (!svgItem.name || !svgItem.content || !svgItem.projectId) {
                status = HttpStatus.BAD_REQUEST;
                msg = config.msg_type.PARAM_ERR;
                break;
            }
        }
    } else {
        if (!sig || !svgList) {
            status = HttpStatus.BAD_REQUEST;
            msg = config.msg_type.PARAM_ERR;
        } else if (uploadFileNum < 1) {
            status = HttpStatus.BAD_REQUEST;
            msg = config.msg_type.FILE_NOT_EXIST;
        } else {
            let user = await models.User.findOne({
                where: {
                    encryptedPassword: sig
                }
            });

            if (!user) {
                msg = config.msg_type.USER_NOT_EXIST;
            } else {
                let userId = user.id;

                Promise.all(svgList.map(async (svg) => {
                    svgItem.name = decodeURIComponent(svgItem.name);
                    svgItem.content = decodeURIComponent(svgItem.content);

                    return await models.Icon.findAll({
                        where: {
                            name: svgItem.name,
                            projectId: svgItem.projectId
                        }
                    });
                })).then(values => {
                    for (let valueItem of values) {

                    }
                });


                for (let svgItem of svgList) {
                    svgItem.name = decodeURIComponent(svgItem.name);
                    svgItem.content = decodeURIComponent(svgItem.content);
                    if (!svgItem.name || !svgItem.content || !svgItem.projectId) {
                        msg = config.msg_type.PARAM_ERR;
                    } else {
                        // 服务器去数据库查该图标的所有版本
                        let icons = await models.Icon.findAll({
                            where: {
                                name: svgItem.name,
                                projectId: svgItem.projectId
                            }
                        });

                        if (icons.length > 0) {
                            // 找到最新线上版本
                            let icon = await models.Icon.findOne({
                                where: {
                                    name: svgItem.name,
                                    projectId: svgItem.projectId,
                                    online: true
                                }
                            });

                            // 之前存在该图标,则旧版本先下线,再插入新版本
                            await models.Icon.update({ online: false }, {
                                where: {
                                    name: icon.name,
                                    projectId: icon.projectId
                                }
                            });

                            await svgo.optimize(svgItem.content, svg => {
                                models.Icon.create({
                                    name: svgItem.name,
                                    author: svgItem.author,
                                    online: true, // 上传默认图标上线
                                    content: svg.data,
                                    projectId: svgItem.projectId,
                                    UserId: userId,
                                    remarks: svgItem.remarks,
                                    version: icon.version + 1,
                                    experienceVersion: false
                                });
                            });
                        }
                        else {
                            // 之前没有该图标,直接插入
                            await svgo.optimize(svgItem.content, svg => {
                                models.Icon.create({
                                    name: svgItem.name,
                                    author: svgItem.author,
                                    online: true, // 上传默认图标上线
                                    content: svg.data,
                                    projectId: svgItem.projectId,
                                    UserId: userId,
                                    remarks: svgItem.remarks,
                                    version: 1,
                                    experienceVersion: false
                                });
                            });
                        }
                    }
                }
                msg = config.msg_type.SUCCESS;
            }
        }
    }

    res.json({
        status,
        msg
    });
});

/**
 * 获取预览版本的图标
 */
router.post('/getFiles', async (req, res, next) => {
    let files = [];
    let icons = await models.Icon.findAll({
        attributes: ['name', 'content', 'author'],
        where: {
            experienceVersion: true
        }
    });

    for (let item of icons) {
        files.push({
            name: item.name,
            content: item.content,
            author: item.author
        });
    }

    res.json({
        status: HttpStatus.OK,
        msg: config.msg_type.SUCCESS,
        data: files
    });
});

/**
 * 用户注册
 */
router.post('/register', async (req, res, next) => {
    let params = req.body;
    let userName = params.username;
    let password = params.password;
    let mail = params.mail;
    let status = HttpStatus.OK;
    let msg = '';
    let sig = '';

    if (userName && password && mail) {
        let user = await models.User.findOne({
            where: {
                userName
            }
        });
        if (user) {
            msg = config.msg_type.USER_EXIST;
        } else {
            let encryptedPassword = util.hashCrypt(userName, password);
            await models.User.create({
                userName,
                encryptedPassword,
                mail
            });
            msg = config.msg_type.SUCCESS;
            sig = encryptedPassword;
        }
    }
    else {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    }

    res.json({
        status,
        msg,
        sig
    });
});

/**
 * 用户登录
 */
router.post('/login', async (req, res, next) => {
    let params = req.body;
    let userName = params.username;
    let password = params.password;
    let signature = params.sig;
    let status = HttpStatus.OK;
    let msg = '';
    let sig = '';

    if (userName && password) {
        let user = await models.User.findOne({
            where: {
                userName
            }
        });

        if (user) {
            if (util.hashCrypt(userName, password) == user.encryptedPassword) {
                msg = config.msg_type.LOGIN_SUC;
                sig = user.encryptedPassword;
            } else {
                msg = config.msg_type.PASSWORD_ERR;
            }
        } else {
            msg = config.msg_type.USER_NOT_EXIST;
        }
    }
    else if(signature) {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: signature
            }
        });
        msg = user ? config.msg_type.LOGIN_SUC : config.msg_type.USER_NOT_EXIST;
        sig = user.encryptedPassword;
        console.log('sig' + sig);
    }
    else {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    }

    res.json({
        status,
        msg,
        sig
    });
});

/**
 * 新建项目
 */
router.post('/createProject', async (req, res, next) => {
    let sig = req.body.sig;
    let proName = req.body.projectname;
    let status = HttpStatus.OK;
    let msg = '';
    let projectId = '';
    let invitedKey = '';

    if (!sig || !proName) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (!user) {
            msg = config.msg_type.USER_NOT_EXIST;
        } else {
            // 检查项目名是否已经存在
            let oldProject = await models.Project.findOne({
                where: {
                    proName
                }
            });

            if (oldProject) {
                msg = config.msg_type.PROJECT_EXIST;
            } else {
                invitedKey = Math.random().toString(36).slice(2, 10).toUpperCase(); // 随机邀请码

                let newProject = await models.Project.create({
                    proName: proName,
                    ownerId: user.id,
                    ownerName: user.userName,
                    invitedKey: invitedKey,
                    online: true
                });

                // 创建项目后,自己自动加入该项目
                await models.ProjectMember.create({
                    ProjectId: newProject.id,
                    UserId: user.id
                });

                msg = config.msg_type.SUCCESS;
                projectId = newProject.id;
            }
        }
    }

    res.json({
        status,
        msg,
        projectId,
        invitedKey
    });
});

/**
 * 删除项目
 */
router.post('/deleteProject', async (req, res, next) => {
    let sig = req.body.sig;
    let proId = req.body.projectid;
    let status = HttpStatus.OK;
    let msg = '';

    if (!sig || !proId) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (!user) {
            msg = config.msg_type.USER_NOT_EXIST;
        } else {
            let project = await models.Project.findOne({
                where: {
                    id: proId
                }
            });

            if (!project) {
                status = HttpStatus.BAD_REQUEST;
                msg = config.msg_type.PROJECT_NOT_EXIST;
            } else {
                if (project.ownerId != user.id) {
                    msg = config.msg_type.NO_AUTH;
                } else {
                    await models.Project.update({ online: false }, {
                        where: {
                            id: proId
                        }
                    });

                    msg = config.msg_type.SUCCESS;
                }
            }
        }
    }

    res.json({
        status,
        msg
    });
});

/**
 * 图标下线
 */
router.post('/deleteIcon', async (req, res, next) => {
    let sig = req.body.sig;
    let iconIdList = JSON.parse(req.body.list);
    let status = HttpStatus.OK;
    let msg = '';
    let notExistIcons = [];

    if (!sig || !iconIdList) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (!user) {
            msg = config.msg_type.USER_NOT_EXIST;
        } else {
            for (let id of iconIdList) {
                let icon = await models.Icon.findOne({
                    where: {
                        id
                    }
                });

                if (icon) {
                    await models.Icon.update({ online: false }, {
                        where: {
                            id
                        }
                    });
                }
                else {
                    notExistIcons.push(id);
                }
            }
            msg = config.msg_type.SUCCESS;
        }
    }

    res.json({
        status,
        msg,
        notExistIcons
    });
});

/**
 * 项目添加成员
 */
router.post('/addMember', async (req, res, next) => {
    let invitedKey = req.body.key;
    let encryptedPassword = req.body.sig;
    let status = HttpStatus.OK;
    let msg = '';

    if (!invitedKey || !encryptedPassword) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let project = await models.Project.findOne({
            where: {
                invitedKey
            }
        });

        if (!project) {
            status = HttpStatus.BAD_REQUEST;
            msg = config.msg_type.PROJECT_NOT_EXIST;
        } else {
            let user = await models.User.findOne({
                where: {
                    encryptedPassword
                }
            });

            if (!user) {
                status = HttpStatus.BAD_REQUEST;
                msg = config.msg_type.USER_NOT_EXIST;
            } else {
                let member = await models.ProjectMember.findOne({
                    where: {
                        UserId: user.id,
                        ProjectId: project.id
                    }
                });

                if (member) {
                    msg = config.msg_type.USER_HAD_JOINED;
                } else {
                    await models.ProjectMember.create({
                        ProjectId: project.id,
                        UserId: user.id
                    });

                    msg = config.msg_type.SUCCESS;
                }
            }
        }
    }

    res.json({
        status,
        msg
    });
});

/**
 * 查询项目
 */
router.post('/queryProject', async (req, res, next) => {
    let sig = req.body.sig;
    let status = HttpStatus.OK;
    let msg = '';
    let list = [];

    if (!sig) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (!user) {
            status = HttpStatus.BAD_REQUEST;
            msg = config.msg_type.USER_NOT_EXIST;
        } else {
            // 自己创建或者加入的项目,都需要可见
            let myProjects = await models.ProjectMember.findAll({
                where: {
                    UserId: user.id
                }
            });

            if (myProjects.length > 0) {
                await Promise.all(myProjects.map(async (projectItem) =>
                    await models.Project.findOne({
                        where: {
                            id: projectItem.projectId,
                            online: true
                        }
                    })
                )).then(values => {
                    for (let valueItem of values) {
                        list.push({
                            projectId: valueItem.id,
                            projectName: valueItem.proName,
                            invitedKey: valueItem.invitedKey,
                            isOwner: user.id == valueItem.ownerId ? true : false
                        });
                    }
                });
            }
        }
    }

    res.json({
        status,
        msg,
        list
    });
});

/**
 * 根据项目 id 查询 icon
 */
router.post('/queryIconByProId', async (req, res, next) => {
    let projectId = req.body.projectid;
    let sig = req.body.sig;
    let status = HttpStatus.OK;
    let msg = '';
    let list = [];

    if (!projectId || !sig) {
        status = HttpStatus.BAD_REQUEST;
        msg = config.msg_type.PARAM_ERR;
    } else {
        let user = await models.User.findOne({
            where: {
                encryptedPassword: sig
            }
        });

        if (!user) {
            status = HttpStatus.BAD_REQUEST;
            msg = config.msg_type.USER_NOT_EXIST;
        } else {
            let icons = await models.Icon.findAll({
                where: {
                    projectId: projectId,
                    online: true,
                    experienceVersion: false
                }
            })
        }

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
                            id: value.id,
                            name: value.name,
                            author: value.author,
                            content: value.content,
                            projectId: value.projectId,
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

/**
 * 查询用户所有图标
 */
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
                        id: icons[item].dataValues.id,
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

/**
 * 根据图标 name 查询所有版本的图标信息
 */
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

            models.Project.findOne({
                where: {
                    id: projectId
                }
            }).then(function (result) {
                if (result == null) {
                    res.json({
                        "status": 400,
                        "msg": '项目不存在'
                    });
                }
                else {
                    // 自己创建的项目
                    if (result.dataValues.ownerId == userId) {
                        console.log('自己的项目');
                        models.Icon.findAll({
                            where: {
                                UserId: userId,
                                projectId: projectId,
                                name: svgName
                            }
                        }).then(function (result) {
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
                                        id: value.id,
                                        name: value.name,
                                        author: value.author,
                                        content: value.content,
                                        projectId: value.projectId,
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
                    else {
                        console.log('加入的项目');
                        // 查询是否是自己加入的项目
                        models.ProjectMember.findOne({
                            where: {
                                UserId: userId,
                                ProjectId: projectId
                            }
                        }).then(function (result) {
                            if (result.length == 0) {
                                res.json({
                                    "status": 200,
                                    "msg": '用户暂未创建/加入该项目'
                                });
                            }
                            else {
                                models.Icon.findAll({
                                    where: {
                                        projectId: projectId,
                                        name: svgName
                                    }
                                }).then(function (result) {
                                    if (result.length == 0) {
                                        res.json({
                                            "status": 200,
                                            "msg": '图标不存在'
                                        });
                                    }
                                    else {
                                        var iconList = [];
                                        for (var item in result) {
                                            var value = result[item].dataValues;
                                            iconList.push({
                                                id: value.id,
                                                name: value.name,
                                                author: value.author,
                                                content: value.content,
                                                projectId: value.projectId,
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
                    }
                }
            });
        }
    });
});

/**
 * 查询指定名称的图标是否存在，返回值：
 * 0: 不存在
 * 1: 存在
 */
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
        res.json({
            "status": 200,
            "code": result.length == 0 ? 0 : 1
        });
    });
});

/**
 * 上传文件
 */
router.post('/uploadHtml', upload.single('image'), function (req, res , next) {
    var randomDir = Math.random().toString(36).slice(2, 8);
    var destinationDir = '/var/www/html/' + randomDir + '/';
    var zip = new AdmZip(req.file.path);

    try {
        zip.extractAllToAsync(destinationDir, true, info => {
            imagemin([destinationDir + '*.{jpg,png}'], destinationDir, {
                use: [
                    imageminJpegtran(),
                    imageminPngquant({ quality: '50' })
                ]
            }).then(data => {
                res.json({
                    "status": 200,
                    "msg": '解压完成',
                    "fileName": req.file.originalname,
                    "dir": randomDir
                });
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
 * 删除上传文件
 */
router.post('/deleteHtml', function (req, res , next) {
    var dirName = req.body.dirname;
    var rootDir = '/var/www/html/';

    if (!dirName) {
        res.json({
            "status": 400,
            "msg": '参数错误'
        });
        return -1;
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

/**
 * 刷新邀请码
 */
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

/**
 * 跳转页面,下载 icon 的 zip 压缩包(包括 svg 和 png)
 */
router.get('/createZip', function (req, res, next) {
    var sig = req.query.sig;
    var projectId = req.query.projectid;

    var svgIds = JSON.parse(req.query.id);
    var remark = req.query.remark || '无';
    console.log('svgIds:' + svgIds);

    var zipDir = '/var/www/html/iconZip/';
    var svgZipName = Math.random().toString(36).slice(2, 8) + '.zip';
    var pngZipName = Math.random().toString(36).slice(2, 8) + '.zip';

    if (!sig || !svgIds) {
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

            models.ProjectMember.findOne({
                where: {
                    UserId: userId,
                    ProjectId: projectId
                }
            }).then(function (result) {
                if (result == null) {
                    // 用户不在这个项目里
                    res.json({
                        "status": 200,
                        "msg": '用户无法操作该项目'
                    });
                }
                else {
                    var svgZip = new AdmZip();
                    var pngZip = new AdmZip();
                    async.each(svgIds, function (id, callback) {
                        console.log('id:' + id);
                        models.Icon.findOne({
                            where: {
                                id: id
                            }
                        }).then(function (result) {
                            // 图标不存在时, result 为 null
                            if (result) {
                                try {
                                    var svgName = result.dataValues.name.indexOf('.svg') != -1 ? result.dataValues.name : result.dataValues.name + '.svg';
                                    var pngName = result.dataValues.name.indexOf('.svg') != -1 ? result.dataValues.name.replace('.svg', '.png') : result.dataValues.name + '.png';
                                    var svgBuff = new Buffer(result.dataValues.content);
                                    console.log('svgName:' + svgName);
                                    console.log('pngName:' + pngName);

                                    async.series(
                                        [
                                            // 压缩 svg
                                            function(cb) {
                                                svgZip.addFile(svgName, svgBuff);
                                                svgZip.writeZip(zipDir + svgZipName);
                                                cb(null);
                                            },
                                            // 压缩 png
                                            function(cb) {
                                                // svg 转换成 png
                                                svg2png(svgBuff)
                                                    .then(function (buffer) {
                                                        pngZip.addFile(pngName, buffer);
                                                        pngZip.writeZip(zipDir + pngZipName);
                                                        callback();
                                                        cb(null);
                                                    })
                                                    .catch(function (err) {
                                                        console.log('1');
                                                        console.log(err);
                                                        callback(err);
                                                        cb(null);
                                                    });
                                            }
                                        ],
                                        function(err, results) {
                                            console.log('2');
                                            console.log(err);
                                            // console.log(results);
                                        }
                                    );
                                } catch (err) {
                                    console.log('3');
                                    console.log(err);
                                    callback(err);
                                }
                            }
                            else {
                                console.log('id为' + id + '的图标不存在');
                                callback('id为' + id + '的图标不存在');
                            }
                        });
                    }, function (err) {
                        if (err) {
                            res.json({
                                "status": 500,
                                "msg": err
                            });
                        }
                        else {
                            res.json({
                                status: 200,
                                data: {
                                    svgZipName: svgZipName,
                                    pngZipName: pngZipName
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

router.get('/downloadZip', function (req, res, next) {
    var remark = req.query.remark;
    var svgZipName = req.query.svgname;
    var pngZipName = req.query.pngname;
    console.log('svgZipName:' + svgZipName);
    console.log('pngZipName:' + pngZipName);

    res.render('downloadZip', {
        remark: remark,
        svgLink: 'http://123.207.94.56/iconZip/' + svgZipName,
        pngLink: 'http://123.207.94.56/iconZip/' + pngZipName
    });
});

module.exports = router;
