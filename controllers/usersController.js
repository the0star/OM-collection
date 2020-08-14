const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const Users = require('../models/users.js')

// Display login form on GET
exports.loginGet = function(req, res, next) {
  res.render('login', { title: 'Login', message: req.flash('message'), user: req.user });
};

exports.loginPost = passport.authenticate('local',{ 
	successRedirect: '/',
	failureRedirect: '/login',
	failureFlash: true
});

// Logout on GET
exports.logout = function(req, res) {     
  req.logout();
  res.redirect('/');
};

// Display signup form on GET
exports.signupGet = function(req, res, next) {
  res.render('signup', { title: 'Signup', user: req.user });
};

exports.signupPost = [
	body('username')
		.notEmpty().withMessage("Name can't be empty"),
		//.isAscii().withMessage("Name contains invalid characters"),
	body('password').trim()
		.notEmpty().withMessage("Password can't be empty")
		//.isAscii().withMessage("Password contains invalid characters")
		.isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
	body('confirmPassword').trim()
		.custom((value,{req, loc, path}) => {
            if (value !== req.body.password) {
                // trow error if passwords do not match
                throw new Error("Passwords don't match");
            } else {
                return value;
            }
        }),
	body('username').escape(),
	body('password').escape(),
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			res.render('signup', { title: 'Signup', user: req.user, errors: errors.array()});
			return;
		}

		Users.findOne({ 'name': req.body.username }, function(err, isUserExist) {
			if (err) {return next(err); }

			if (isUserExist) {
				req.flash('message', 'Username taken')
				res.render('signup', { title: 'Signup', user: req.user });
			}
			else {
				bcrypt.genSalt(12, (err, salt) => {
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
		})
	}
];

exports.signupCheckUsername = function(req, res) {
	Users.findOne({ 'name': req.body.username }, function(err, isUserExist) {
		if (err) { res.send('error'); return; }

		if (isUserExist) {
			res.send(true);
		} 
		else {
			res.send(false);
		}
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

passport.use(new LocalStrategy({ passReqToCallback : true },
	function(req, username, password, next) {
		Users.findOne({name: username}, function (err, user) {
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