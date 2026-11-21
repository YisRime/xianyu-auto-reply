INSERT INTO xy_system_settings(`key`, value, description) VALUES('login_captcha_enabled','false','登录滑动验证开关')
ON DUPLICATE KEY UPDATE value='false';
SELECT `key`, value FROM xy_system_settings WHERE `key`='login_captcha_enabled';
