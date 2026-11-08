import {Page} from "@playwright/test";
export interface PurchaseData 
{
    month: string;
    year: string;
    cardNumber: string;
    cvv: string;
    cardHolderName: string;
    abstractCountryName: string;
    fullCountryName: string;
}


export class CheckOut
{
    constructor(private page: Page) {}
    

    private locateCardNumberInputField()
    {
        return this.page.locator("xpath=//div[div[contains(text(),'Credit Card Number')]]/input[@type='text']");
    }

    async enterCardNumber(cardNumber: string)
    {
        await this.locateCardNumberInputField().fill(cardNumber);
    }

    private locateCvvInputField()
    {
        return this.page.locator("xpath=//div[div[contains(text(),'CVV')]]/input[@type='text']");
    }

    async enterCvv(cvv: string)
    {
        await this.locateCvvInputField().fill(cvv);
    }

    private locateExpiryMonthInputMenu()
    {
        return this.page.getByRole('combobox').first();
    }

    async selectExpiryMonth(month: string)
    {
        await this.locateExpiryMonthInputMenu().selectOption({ label: month });
    }

    private locateExpiryYearInputMenu()
    {
        return this.page.locator('.input.ddl').nth(1);
    }   

    async selectExpiryYear(year: string)
{
    await this.locateExpiryYearInputMenu().selectOption({ label: year });
}


    private locateCardHolderNameInputField()
    {
        return this.page.locator("xpath=//div[div[contains(text(),'Name on Card')]]/input[@type='text']");
    }

    async enterCardHolderName(cardHolderName: string)
    {
        await this.locateCardHolderNameInputField().fill(cardHolderName);
    }


    private locateCountryInputField()
        {
            return this.page.getByRole('textbox', { name: 'Select Country' });
        }
    
        async enterCountry (abstractCountryName: string)
        {
            await this.locateCountryInputField().pressSequentially(abstractCountryName, { delay: 100 });
        }

        private suggestedCountriesList(fullCountryName: string)
        {
            return this.page.getByRole('button').filter({ hasText: fullCountryName });

        }
        
        async selectCountryFromSuggestions (fullCountryName: string)
        {  
            await this.suggestedCountriesList(fullCountryName).click();
        }

        private locatePurchaseButton()
        {
            return this.page.getByText('Place Order');
        }

        async clickPurchaseButton()
        {
            await this.locatePurchaseButton().click();
        }

        public locateOrderConfirmationMessage()
        {
            return this.page.getByText('Thankyou for the order.');
        }

        

    async completePurchase(data: PurchaseData)
    {
        await this.enterCardNumber(data.cardNumber);
        await this.enterCvv(data.cvv);
        // await this.clickExpiryMonthMenu();
        await this.selectExpiryMonth(data.month);
        // await this.clickExpiryYearMenu();
        await this.selectExpiryYear(data.year);
        await this.enterCardHolderName(data.cardHolderName);
        await this.enterCountry(data.abstractCountryName);
        await this.selectCountryFromSuggestions(data.fullCountryName);
        await this.clickPurchaseButton();
        
    }

}