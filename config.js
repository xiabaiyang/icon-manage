var config = {
    session_secret: '533aaaf35c5f55dd6b006f8b',
    auth_cookie_name: process.env.AUTH_COOKIE_NAME || 'secret',
    PROJECT_DIR: __dirname,
    env: process.env.NODE_ENV,
    msg_type: {
        SUCCESS: 'success',
        LOGIN_SUC: '登录成功',
        PARAM_ERR: '参数错误',
        PASSWORD_ERR: '密码错误',
        USER_EXIST: '用户名已存在',
        PROJECT_EXIST: '项目名已存在',
        USER_NOT_EXIST: '用户名不存在',
        FILE_NOT_EXIST: '没有选择要上传的文件'
    }
};

module.exports = config;