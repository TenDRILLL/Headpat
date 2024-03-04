import {
    totp
} from "speakeasy";
import {randomBytes} from "crypto";

function createSecret(): string {
    const bytes = randomBytes(32);
    const set = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let output = "";
    for (let i = 0, l = bytes.length; i < l; i++) {
        output += set[Math.floor(bytes[i] / 255.0 * (set.length - 1))];
    }
    //console.log(output);
    return output;
}

function verifyTOTP(secret: string, token: string): boolean {
    return totp.verify({
        secret,
        encoding: "base32",
        token
    });
}

export {
    createSecret,
    verifyTOTP
};

/*
Should display QR and check the first code prior to applying, work for future.

const qr = speakeasy.otpauthURL({secret: secret, label: 'My App'});
const QRCode = require('qrcode');

QRCode.toDataURL(secret.otpauth_url, function(err, data_url) {
  console.log(data_url);
  write('<img src="' + data_url + '">');
});
*/