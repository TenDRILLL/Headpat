export default class Auth {
    ID: string;
    email?: string;
    passHash?: string;
    tfaSecret: string;
    sessionSecret: string;
    ssoID?: string;
}