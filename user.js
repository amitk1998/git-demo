const {Sequelize} = require('sequelize');

module.exports = function(sequelize, DataType){

	const user = sequelize.define('user', {
		user_code: {
			type : Sequelize.STRING,
            unique: true
		},
		user_name:{
			type : Sequelize.STRING,
		},
		password: {
			type : Sequelize.STRING,
		},
		user_role:{
			type : Sequelize.STRING,
		},
		change_password:{
			type : Sequelize.BOOLEAN,
		},
		isActive: {
			type : Sequelize.BOOLEAN,
		},
		user_type: {
			type : Sequelize.STRING,
		},
		isBlock:{
			type : Sequelize.BOOLEAN,
		},
		nNoOfFailedLogins: {
			type : Sequelize.INTEGER,
		},
		email_id:{
			type : Sequelize.STRING,
		},
		company_code:{
			type : Sequelize.STRING,
		},
		mobile:{
			type : Sequelize.STRING,
		},
		tcl_branch_location:{
			type : Sequelize.STRING,
		},
		tcl_branch:{
			type : Sequelize.STRING,
		},
		store_code:{
			type : Sequelize.STRING,
		},
		vendor:{
			type : Sequelize.STRING,
		},
		store_location:{
			type : Sequelize.STRING,
		},
		product:{
			type : Sequelize.STRING,
		},
		login_date:{
			type : Sequelize.DATE,
		},
		login_time:{
			type : Sequelize.TIME,
		},
		login_token_id:{
			type : Sequelize.TEXT,
		},
		case_approval_flag:{
			type:Sequelize.STRING,
		}
	},
	{
		freezeTableName: true,
	});

	return user;
};

