import {Page} from "@playwright/test";

export class LogInPage {

    constructor(private page: Page) {}

    async navigateTo(url: string) 
    {
        await this.page.goto(url);
    }

    private locateEmailField()
    {
        return this.page.locator("#userEmail");
    }

    async enterEmail(email: string)
    {
        await this.locateEmailField().fill(email);
    }

    private locatePasswordField()
    {
        return this.page.locator("#userPassword");
    }

    async enterPassword(password: string)
    {
        await this.locatePasswordField().fill(password);
    }

    private locateLoginButton()
    {
        return this.page.getByRole("button", { name: "login" });
    }

    async clickLoginButton()
    {
        await this.locateLoginButton().click();
    }

    async login(email: string, password: string)
    {
        await this.enterEmail(email);
        await this.enterPassword(password);
        await this.clickLoginButton();
    }
}