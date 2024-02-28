export default class User {
    ID: string;
    username: string;
    profilePicture?: string;
    discriminator?: string;
    role: string;
    createdAt: string;
    servers: string[];
}