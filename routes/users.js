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

router.post('/file_upload', upload.array('image'), function (req, res) {
    // console.log('loading...');
    // console.log(req.files);
    var fileType = req.body.fileType;
    var uploadFileNum = req.files.length;
    var des_file = [];
    var fileOriginalName = [];
    if (uploadFileNum < 1) {
        res.json({
            "status": 400,
            "msg": "没有选择要上传的文件"
        });
        return -1;
    }

    for (var i = 0; i < uploadFileNum; i++) {
        var count = 0; // 存储文件计数用
        (function (i) {
            fileOriginalName[i] = req.files[i].originalname;
            fs.readFile(req.files[i].path, 'utf-8', function (err, data) {
                if (err) {
                    res.json({
                        "status": 500,
                        "msg": '文件保存失败'
                    });
                }
                else {
                    models.Icon.create({
                        name: fileOriginalName[i], // SVG 文件名
                        content: data, // SVG 文件内容
                        UserId: 1 // 用户id,这个版本默认是 1
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
                }
            });
        })(i)
    }
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

module.exports = router;
