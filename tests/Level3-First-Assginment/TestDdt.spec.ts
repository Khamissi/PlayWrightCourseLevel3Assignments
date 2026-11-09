import { test, expect, Page, Request, TestInfo } from '@playwright/test';
import LogInData from './test data/LogInData.json';
import { LogInPage } from './pages/LogIn';
import { ShopPage } from './pages/shopPage';
import ProductData from './test data/ProductData.json';
import ProductDelete from './test data/ProductDelete.json';
import { CheckOut } from './pages/CheckOut';
import Urls from './test data/Urls.json';
import path from 'path';

// Saves a full-page screenshot as evidence in:
//   tests/Level3-First-Assginment/evidences/<folder>/<browser>/<passed|failed|timedOut>/<test title>[-retryN].png
// It is also attached to the HTML report, next to the test result.
async function saveEvidence(page: Page, testInfo: TestInfo, folder: string) {
    // Skipped tests never opened a page, so there is nothing to capture
    if (testInfo.status === 'skipped') return;

    // Each retry gets its own file, so the flaky first attempt's screenshot is kept
    const retrySuffix = testInfo.retry > 0 ? `-retry${testInfo.retry}` : '';
    const screenshotName = testInfo.title.replace(/[<>:"/\\|?*]/g, '') + retrySuffix;
    const screenshotPath = path.join(
        path.dirname(testInfo.file), 'evidences', folder, testInfo.project.name,
        testInfo.status ?? 'unknown', `${screenshotName}.png`
    );

    try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach(`evidence (${testInfo.status})`, { path: screenshotPath, contentType: 'image/png' });
    } catch (error) {
        // e.g. the page crashed or was closed: don't let this hide the test's real error
        console.warn(`Could not save evidence for "${testInfo.title}": ${error}`);
    }
}




test.describe.configure({ mode: 'default' });
const SHARED_ACCOUNT_BROWSER = 'chromium';
const SKIP_REASON = 'Shared account: successful logins run in Chromium only (login empties the cart)';
const CI_SKIP_REASON = 'Shared account: on CI the cart flow runs in Chromium only, so parallel browser jobs do not empty each other\'s cart';

// Tags: run a subset with  npx playwright test --grep @smoke  (or the npm scripts in package.json)
const TAGS = {
    positiveLogin: ['@smoke', '@regression', '@positive', '@login'],
    negativeLogin: ['@regression', '@negative', '@login'],
    positiveCart:  ['@smoke', '@regression', '@positive', '@cart'],
    negativeCart:  ['@regression', '@negative', '@cart'],
};

// Credentials: GitHub Secrets (SHOP_EMAIL / SHOP_PASSWORD) when set, otherwise the values in the JSON files.
const DEFAULT_EMAIL = ProductData[0].email;
const DEFAULT_PASSWORD = ProductData[0].password;
const ACCOUNT = {
    email: process.env.SHOP_EMAIL || DEFAULT_EMAIL,
    password: process.env.SHOP_PASSWORD || DEFAULT_PASSWORD,
};
// JSON rows that use the shared account switch to the secret; deliberately wrong/empty values stay as they are.
const resolveEmail = (email: string) => (email === DEFAULT_EMAIL ? ACCOUNT.email : email);
const resolvePassword = (password: string) => (password === DEFAULT_PASSWORD ? ACCOUNT.password : password);

const ValidProducts = ProductData.filter(product => product.shouldExist);
const InvalidProducts = ProductData.filter(product => !product.shouldExist);

test.describe('Test Just log in', () => {
    for (const data of LogInData) {
        test(`Log in with ${data.TestCaseID}`, { tag: data.shouldSucceed ? TAGS.positiveLogin : TAGS.negativeLogin }, async ({ page, browserName }) => {
            test.skip(data.shouldSucceed && browserName !== SHARED_ACCOUNT_BROWSER, SKIP_REASON);
            const testLogInObject = new LogInPage(page);
            await testLogInObject.navigateTo(Urls.RauhShettyLogInRegisterUrl);
            await testLogInObject.login(resolveEmail(data.email), resolvePassword(data.password));

            if (data.shouldSucceed) {
                // Valid login: user is redirected to the shop dashboard
                await expect(page).toHaveURL(Urls.RauhShettyShopUrl);
            } else {
                // Invalid login: the expected error is shown and the user stays on the login page
                await expect(page.getByText(data.expectedError)).toBeVisible();
            }
        });
    }

    test.afterEach(async ({ page }, testInfo) => {
        await saveEvidence(page, testInfo, 'LogIn');
    });
});


test.describe('Cart flow: shared login', () => {
    let page: Page;

    test.beforeAll(async ({ browser, browserName }) => {
        // Skipping here skips every test in this group (and avoids logging in at all)
        test.skip(!!process.env.CI && browserName !== SHARED_ACCOUNT_BROWSER, CI_SKIP_REASON);

        page = await browser.newPage();
        const testLogInObject = new LogInPage(page);
        await testLogInObject.navigateTo(Urls.RauhShettyLogInRegisterUrl);
        await testLogInObject.login(ACCOUNT.email, ACCOUNT.password);
        await expect(page).toHaveURL(Urls.RauhShettyShopUrl);
    });

    test.afterAll(async () => {
        await page?.close();
    });

test.describe('Test purchase product', () => {
    //test.skip(({ browserName }) => browserName !== SHARED_ACCOUNT_BROWSER, SKIP_REASON);

    for (const data of ValidProducts) {
        test(`${data.TestCaseID}: purchase ${data.productName}`, { tag: TAGS.positiveCart }, async () => {
            const testShopPageObject = new ShopPage(page);
            //const testCheckOutObject = new CheckOut(page);

            // Already logged in (beforeAll): just go back to the shop and add the product
            await page.goto(Urls.RauhShettyShopUrl);
            await testShopPageObject.addProductToCart(data.productName);
         
        });
    }

    test.afterEach(async ({}, testInfo) => {
        await saveEvidence(page, testInfo, 'Shop');
    });
});


test.describe('Test select non-existent product', () => {
    for (const data of InvalidProducts) {
        test(`${data.TestCaseID}: select non-existent ${data.productName}`, { tag: TAGS.negativeCart }, async () => {
            const testShopPageObject = new ShopPage(page);

            // Record any add-to-cart call, to prove nothing was sent to the server
            const addToCartRequests: string[] = [];
            const trackAddToCart = (request: Request) => {
                if (request.url().includes('add-to-cart')) addToCartRequests.push(request.url());
            };
            page.on('request', trackAddToCart);

            try {
                await page.goto(Urls.RauhShettyShopUrl);

                // The product is not in the shop (checked after the product grid has loaded)
                expect(await testShopPageObject.isProductListed(data.productName),
                    `"${data.productName}" should not be listed in the shop`).toBe(false);

                // Trying to add it fails with a clear error instead of a click timeout
                await expect(testShopPageObject.addProductToCart(data.productName))
                    .rejects.toThrow(`Product "${data.productName}" is not listed in the shop`);

                // And no add-to-cart request reached the server
                expect(addToCartRequests, 'no add-to-cart request should be sent').toHaveLength(0);
            } finally {
                // The page is shared by the whole group: don't leave the listener behind
                page.off('request', trackAddToCart);
            }
        });
    }

    test.afterEach(async ({}, testInfo) => {
        await saveEvidence(page, testInfo, 'Shop');
    });
});


test.describe('Test delete product', () => {
    test.skip(({ browserName }) => browserName !== SHARED_ACCOUNT_BROWSER, SKIP_REASON);

    for (const data of ProductDelete) {
        test(`${data.TestCaseID}: delete ${data.productName}`, { tag: TAGS.positiveCart }, async () => {
            const testShopPageObject = new ShopPage(page);

            // Precondition: normally the purchase tests above already put the product in the cart.
            // But a retry runs in a new worker, beforeAll logs in again and login empties the cart,
            // so add the product back if it is missing. The test then always has something to delete.
            if (!(await testShopPageObject.isProductInCart(data.productName))) {
                await page.goto(Urls.RauhShettyShopUrl);
                await testShopPageObject.clickAddToCartButtonForSpecificProduct(data.productName);
            }

            // The product must really be deleted: "nothing to delete" is a failure, not a pass
            expect(await testShopPageObject.deleteProductFromCart(data.productName),
                `"${data.productName}" should have been in the cart and deleted`).toBe(true);
        });
    }

    test.afterEach(async ({}, testInfo) => {
        await saveEvidence(page, testInfo, 'Shop');
    });
});

}); 
