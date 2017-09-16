var config = {
    session_secret: '533aaaf35c5f55dd6b006f8b',
    auth_cookie_name: process.env.AUTH_COOKIE_NAME || 'secret',
    login_path: '/login',
    PROJECT_DIR: __dirname,
    env: process.env.NODE_ENV,
    msg_type: {
        LOGIN_SUC: '登录成功',
        PASSWORD_ERR: '密码错误',
        USER_NOT_EXIST: '用户不存在',
        PARAM_ERR: '参数错误',
        SUCCESS: 'success'
    }
};

module.exports = config;