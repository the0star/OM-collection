const Users = require('../models/users.js')
const Codes = require('../models/verificationCodes.js')

const bcrypt = require('bcrypt')
const cryptoRandomString = require('crypto-random-string');
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const { body, validationResult } = require('express-validator');
const async = require('async');
const nodemailer = require('nodemailer');

require('dotenv').config();

exports.loginGet = function(req, res, next) {
  res.render('login', { title: 'Login', message: req.flash('message'), user: req.user });
};

exports.loginPost = passport.authenticate('local',{ 
	successRedirect: '/',
	failureRedirect: '/login',
	failureFlash: true
});

exports.logout = function(req, res) {     
  req.session.destroy(function (err) {
  	res.redirect('/');
  });
};

exports.signupGet = function(req, res, next) {
  res.render('signup', { title: 'Signup', user: req.user });
};

exports.signupPost = [
	body('username')
		.notEmpty().withMessage("Username can't be empty")
		.matches(/^[A-Za-z0-9._-]+$/).withMessage('Username contains invalid characters'),
	body('password')
		.isLength({ min: 8 })
		.matches(/^[0-9a-zA-Z!@#$%^]+$/).withMessage('Password contains invalid characters'),
	body('username').escape(),
	body('password').escape(),
	async function(req, res, next) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.render('signup', { title: 'Signup', user: req.user, errors: errors.array()});
			return;
		}

		var [err, exists] = await userExists(req.body.username);
		if (err) { return next(err); }
			
		if (exists) {
			req.flash('message', 'Username taken')
			res.render('signup', { title: 'Signup', user: req.user });
		}
		else {
			bcrypt.genSalt(12, (err, salt) => {
				if (err) { return next(err); }
				bcrypt.hash(req.body.password, salt, function (err, hash) {
					if (err) { return next(err); }
					var user = new Users({
						name: req.body.username,
						password: hash,
						isAdmin: false
					});
					user.save(function (err) {
						if (err) {return next(err); }
						req.login(user, function(err) {
							if (err) { return next(err); }
							res.redirect('/');
						});
					});
				});
			});
		}
	}
];

async function userExists(username) {
	var userQuery = Users.findOne({ 'name': { $regex : new RegExp('^' + username + '$', "i") } });
	try {
		var user = await userQuery.exec();
	} catch(err) {
		return [err, null];
	}
	return [null, user ? true : false];
}

exports.signupCheckUsername = async function(req, res) {
	var [err, exists] = await userExists(req.body.username);
	if (err) { res.send('error'); return; }
	if (!exists) {
		res.send(false);
	}
	res.send(true);
}

exports.accountPage = function(req, res, next) {
	res.render('account', { title: 'Account settings', user: req.user });
}

exports.sendVerificationEmail = function(req, res, next) {
	Users.findOne({ name: req.params.name}, function (err, user) {
		if (err) {
			return res.json({ err: true, message: err.message });
		}
		if (!user) {
			var err = new Error('Wrong password');
			return next(null, false, req.flash('message', 'No such user'))
		}
		bcrypt.compare(password, user.password, function (err, result) {
			if (err) {
				return res.json({ err: true, message: err.message });
			}
			if (!result) {
				var err = new Error('Wrong password');
				return res.json({ err: true, message: err.message });
			}
			else {
				Codes.deleteMany({user: req.params.name}, (err) => {
					if (err) {
						return res.json({ err: true, message: err.message });
					}

					var code = cryptoRandomString({length: 128, type: 'url-safe'});
					var transporter = nodemailer.createTransport({
						host: 'smtp.gmail.com',
						secure: true,
						port: 465,
						auth: {
							user: process.env.EMAIL,
							pass: process.env.EMAIL_PASSWORD
						}
					});
					var mailOptions = {
						from: process.env.EMAIL,
						to: req.body.email,
						subject: 'Email confirmation',
						text: "You've received this message because your email was used to bind an account on karasu-os.com. To confirm the email please open this link: \n\nkarasu-os.com/user/"+req.params.name+"/confirmEmail/"+code+"\n\nIf you didn't request email binding please ignore this message."
					};
				});

				transporter.sendMail(mailOptions, function(err, info){
					if (err) {
						return res.json({ err: true, message: err.message });
					} else {
						return res.json({ err: false });
					}
				}); 
			}
		});
	})
}

exports.verifyEmail function(req, res, next) {
	Codes.findOneAndDelete({user: req.params.name, code: req.params.code}, (err, record) => {
		if (err) {
			return next(err);
		}
		if (!record) {
			var err = new Error('Invalid link');
			return next(err);
		}
		var setEmail = Users.updateOne({name: req.user.name}, {email: record.email}, (err) => {
			if (err) {
				return next(err);
			}
			res.redirect('/user/'+record.user);
		});
	});
}

exports.isLoggedIn = function () {
	return function (req, res, next) {
		if (req.isAuthenticated()) {
			return next()
		}
		req.flash('message', 'You must be logged in');
		res.redirect('/login');
	}
}

exports.isAdmin = function () {
	return function (req, res, next) {
		if (req.user && req.user.isAdmin) {
			return next()
		}
		var err = new Error('You have no permission for this action');
		return next(err);
	}
}

exports.isSameUser = function () {
	return function (req, res, next) {
		if (req.user && (req.user.name == req.params.name || req.user.isAdmin)) {
			return next()
		}
		var err = new Error('You must be logged in your account');
		return next(err);
	}
}

passport.use(new LocalStrategy({ passReqToCallback : true },
	function(req, username, password, next) {
		Users.findOne({ 'name': { $regex : new RegExp('^' + username + '$', "i") }}, function (err, user) {
			if (err) { return next(err) }
			if (!user) {
				return next(null, false, req.flash('message', 'No such user'))
			}
			bcrypt.compare(password, user.password, function (err, result) {
				if (err) { return next(err) }
				if (!result)
					return next(null, false, req.flash('message', 'Wrong password'))
				else
					return next(null, user)
			});
		})
	}
))

passport.serializeUser(function(user, next) {
  next(null, user.id);
});

passport.deserializeUser(function(id, next) {
  Users.findById(id, function(err, user) {
	next(err, user);
  });
});