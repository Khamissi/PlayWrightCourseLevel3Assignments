import { Page,expect } from "@playwright/test";

export class ShopPage 
{
    constructor(private page: Page) {}

    private locateProductCard(productName: string) 
    {
        return this.page.locator('div', { has: this.page.getByRole('heading', { name: productName, exact: true }) }).last();
    }

    private locateAllAddToCartButtons()
    {
        return this.page.getByRole('button', { name: /Add To Cart/i });
    }

    // Waits for the product grid to load first, so "not found" can't be caused by a page that is still loading.
    async isProductListed(productName: string): Promise<boolean>
    {
        await expect(this.locateAllAddToCartButtons().first()).toBeVisible();
        return (await this.locateProductCard(productName).count()) > 0;
    }

    async clickAddToCartButtonForSpecificProduct(productName: string)
    {
        // Fail fast with a clear message instead of waiting for the click to time out
        if (!(await this.isProductListed(productName))) {
            throw new Error(`Product "${productName}" is not listed in the shop`);
        }

        const card = this.locateProductCard(productName);
        const addedToCart = this.page.waitForResponse(
            response => response.url().includes('add-to-cart') && response.request().method() === 'POST'
        );
        await card.getByRole('button', { name: ' Add To Cart' }).click();
        expect((await addedToCart).ok()).toBeTruthy();
    }

    private locateCartButton() 
    {
    return this.page.locator('button[routerlink="/dashboard/cart"]');
    }

    async clickCartButton()
    {
        await this.locateCartButton().click();
    }

    // The number badge on the Cart button. It shows "1", "2", ... and is empty (not "0") when the cart is empty.
    private locateCartCount()
    {
        return this.locateCartButton().locator('label');
    }

    async getCartCount(): Promise<number>
    {
        const text = (await this.locateCartCount().textContent())?.trim() ?? '';
        return text === '' ? 0 : Number(text);
    }

    async expectCartCount(expected: number)
    {
        await expect(this.locateCartCount(),
            `Cart button should show ${expected} item(s)`).toHaveText(expected === 0 ? /^\s*$/ : String(expected));
    }

    public locateCartItem(productName: string) 
    {
        return this.page.getByText(productName);
    }

    async addProductToCart(productName: string) 
    {
        await this.clickAddToCartButtonForSpecificProduct(productName);
        await this.clickCartButton();
    }
    
    private locateCartRow(productName: string) 
    {
        return this.page.locator('li.items')
            .filter({ has: this.page.getByRole('heading', { name: productName, exact: true }) });
    }

    private locateDeleteButtonForSpecificProduct(productName: string) 
    {
        return this.locateCartRow(productName).locator('button.btn-danger').first();
    }

    private locateCartProductsTable() 
    {
        return this.page.locator('ul.cartWrap');
    }

    private locateEmptyCartMessage() 
    {
        return this.page.getByRole('heading', { name: /No Products in Your Cart/i });
    }

    // Opens the cart and waits until it has loaded: it shows either the products table or the empty-cart message
    private async openCart()
    {
        await this.clickCartButton();
        await expect(this.locateCartProductsTable().or(this.locateEmptyCartMessage()).first()).toBeVisible();
    }

    // Opens the cart and tells whether it holds at least one row of this product.
    async isProductInCart(productName: string): Promise<boolean>
    {
        await this.openCart();
        if (await this.locateEmptyCartMessage().isVisible()) return false;
        return (await this.locateCartRow(productName).count()) > 0;
    }

    // Returns true if the product was deleted, false if there was nothing to delete.
    async deleteProductFromCart(productName: string): Promise<boolean>
    {
        await this.openCart();
        const cartRow = this.locateCartRow(productName);

        if (await this.locateEmptyCartMessage().isVisible()||await cartRow.count() === 0) 
            {
            console.log('No products added');
            return false;
            }

        // Deletes exactly one row: other products, and other rows of the same product, stay in the cart
        const allCartRows = this.page.locator('li.items');
        const totalRowsBefore = await allCartRows.count();
        const productRowsBefore = await cartRow.count();
        const cartCountBefore = await this.getCartCount();

        await this.locateDeleteButtonForSpecificProduct(productName).click();

        // The number on the Cart button goes down by one too
        await this.expectCartCount(cartCountBefore - 1);

        if (totalRowsBefore === 1) {
            // Deleting the last product replaces the table with the empty-cart message
            await expect(this.locateEmptyCartMessage()).toBeVisible();
        } else {
            await expect(cartRow).toHaveCount(productRowsBefore - 1);
            await expect(allCartRows).toHaveCount(totalRowsBefore - 1);
        }
        return true;
    }

    private locateCheckoutButton() 
    {
        return this.page.getByRole('button', { name: /checkout/i });
    }

    async clickCheckoutButton() 
    {
        await this.locateCheckoutButton().click();
    }

    
    



    
}