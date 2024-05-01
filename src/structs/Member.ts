import User from "./User";

export default class Member {
    ID: string;
    username: string;
    profilePicture?: string;
    discriminator: string;
    role: string;
    createdAt: string;
}