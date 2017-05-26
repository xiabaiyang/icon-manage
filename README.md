# icon-manage

1.用户注册(post)：http://127.0.0.1:3000/users/register
参数：
username  (String)
password   (String)

返回：
{
    msg = succ;
    status = 200;
}


2.用户登录(post)：http://127.0.0.1:3000/users/login
参数：
username  (String)
password   (String)

返回：
{
    msg = "登录成功";
    sig = fed9a4cfd84605486dc79df5eedfa3e3;
    status = 200;
}

3.新建项目(post)：http://127.0.0.1:3000/users/createProject
参数：
projectname  (String)
sig   (String)

返回：
{
    msg = succ;
    projectId = 1;
    status = 200;
}

4.新建类目(post)：http://127.0.0.1:3000/users/createCategory
参数：
projectname  (String)
sig   (String)
返回：
{
    categoryId = 1;
    msg = succ;
    status = 200;
}
5.项目添加成员(post)：http://127.0.0.1:3000/users/addMember
参数：
projectname  (String)
sig   (String)
返回：
{
    msg = succ;
    status = 200;
}

5.项目添加成员(post)：http://127.0.0.1:3000/users/addMember
参数：
projectname  (String)
sig   (String)
返回：
{
    msg = succ;
    status = 200;
}


6.查询项目和类目信息(post)：http://127.0.0.1:3000/users/queryProject
参数：
sig   (String)
返回：
{
    list =     (
                {
            categoryList =             (
                                {
                    categoryId = 1;
                    categoryName = ppp;
                }
            );
            projectId = 1;
            projectName = www;
        },
                {
            categoryList =             (
                                {
                    categoryId = 1;
                    categoryName = ppp;
                }
            );
            projectId = 2;
            projectName = qqq;
        }
    );
    msg = succ;
    status = 200;
}
