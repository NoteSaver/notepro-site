from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, TextAreaField, BooleanField
from wtforms.validators import (
    DataRequired, Length, Email, EqualTo, ValidationError, Regexp, Optional
)

from models import User

# ---------------------------------------------
# 🔒 Global Password Constants for Reusability
# ---------------------------------------------

# Regexp enforces: Min 8 chars, one uppercase, one lowercase, one digit, one special char
PASSWORD_REGEXP = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'
PASSWORD_MESSAGE = 'Password must be at least 8 characters long and include one uppercase, one lowercase, one number, and one special character (@$!%*?&).'


# ---------------------------
# Registration Form
# ---------------------------

class RegistrationForm(FlaskForm):
    """User registration form with validation."""
    username = StringField('Username', validators=[
        DataRequired(), Length(min=3, max=80)
    ])
    email = StringField('Email', validators=[
        DataRequired(), Email()
    ])
    first_name = StringField('First Name', validators=[
        Optional(), Length(max=50)
    ])
    last_name = StringField('Last Name', validators=[
        Optional(), Length(max=50)
    ])
    mobile_number = StringField('Mobile Number', validators=[
        Optional(), Length(max=20)
    ])
    
    # === UPDATED: Strong Password Validation ===
    password = PasswordField('Password', validators=[
        DataRequired(), 
        Length(min=8), # Min length check
        Regexp(PASSWORD_REGEXP, message=PASSWORD_MESSAGE) # Complexity check
    ])
    confirm_password = PasswordField('Confirm Password', validators=[
        DataRequired(), EqualTo('password', message='Passwords must match.')
    ])
    submit = SubmitField('Register')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('Username already exists. Please choose another.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('Email already registered. Please login or reset password.')

# ---------------------------
# Login Form
# ---------------------------

class LoginForm(FlaskForm):
    """User login form."""
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

# ---------------------------
# Note Form (Create / Edit)
# ---------------------------

class NoteForm(FlaskForm):
    """Form for creating and editing notes."""
    title = StringField('Title', validators=[
        DataRequired(message="Title is required."),
        Length(max=200, message="Title must be under 200 characters.")
    ])
    
    letterhead = StringField('Letter Head', validators=[
        Length(max=200, message="Letter Head must be under 200 characters.")
    ])

    category = StringField('Category', validators=[
        Length(max=50, message="Category name too long.")
    ])
    
    content = TextAreaField('Content', validators=[
        DataRequired(message="Note content cannot be empty.")
    ])

    is_private = BooleanField('Private Mode')
    private_password = PasswordField('Password (if private)')
    
    submit = SubmitField('Save Note')

    def validate_private_password(self, field):
        if self.is_private.data and not field.data:
            raise ValidationError('जब Private Mode चालू हो, तो पासवर्ड जरूरी है।')
        # Changed min length to 8 for consistency
        if field.data and len(field.data) < 8: 
            raise ValidationError('पासवर्ड कम से कम 8 अक्षर का होना चाहिए।')


# ---------------------------
# Request Password Reset Form
# ---------------------------

class RequestResetForm(FlaskForm):
    """Form to request a password reset link."""
    email = StringField('Email', validators=[
        DataRequired(), Email()
    ])
    submit = SubmitField('Request Password Reset')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is None:
            raise ValidationError('No account found with this email. Please register first.')
            


# ---------------------------
# Request Username Form
# ---------------------------

class RequestUsernameForm(FlaskForm):
    """Form to request a username reminder."""
    email = StringField('Email', validators=[
        DataRequired(), Email()
    ])
    submit = SubmitField('Remind Me Username')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is None:
            # सुरक्षा कारणों से, आपको कभी नहीं बताना चाहिए कि ईमेल मौजूद नहीं है।
            # आप यहाँ कोई ValidationError नहीं उठाएंगे।
            pass 

# ---------------------------            
            

# ---------------------------
# Reset Password Form
# ---------------------------

class ResetPasswordForm(FlaskForm):
    """Form to reset the password."""
    # === UPDATED: Strong Password Validation ===
    password = PasswordField('New Password', validators=[
        DataRequired(), 
        Length(min=8), # Min length check
        Regexp(PASSWORD_REGEXP, message=PASSWORD_MESSAGE) # Complexity check
    ])
    confirm_password = PasswordField('Confirm New Password', validators=[
        DataRequired(), EqualTo('password', message="Passwords must match.")
    ])
    submit = SubmitField('Reset Password')