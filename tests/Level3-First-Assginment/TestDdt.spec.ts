import { test, expect, Page, TestInfo } from '@playwright/test';
import LogInData from './test data/LogInData.json';
import { LogInPage } from './pages/LogIn';
import { ShopPage } from './pages/shopPage';
import ProductData from './test data/ProductData.json';
import ProductDelete from './test data/ProductDelete.json';
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


// Every successful login uses the same shop account, and logging in empties its cart.
// So all tests that log in successfully run in Chromium only, in order, in one worker (see the "Shared account" group).
const SHARED_ACCOUNT_BROWSER = 'chromium';
const SKIP_REASON = 'Shared account: tests that log in successfully run in Chromium only (login empties the cart)';

// Tags: run a subset with  npx playwright test --grep @smoke  (or the npm scripts in package.json)
// @smoke = valid login + products are visible. The cart flow is @regression only.
const TAGS = {
    smoke:         ['@smoke', '@regression', '@positive'],
    positiveLogin: ['@smoke', '@regression', '@positive', '@login'],
    negativeLogin: ['@regression', '@negative', '@login'],
    positiveCart:  ['@regression', '@positive', '@cart'],
    negativeCart:  ['@regression', '@negative', '@cart'],
};

// Credentials come only from SHOP_EMAIL / SHOP_PASSWORD (.env locally, repository secrets on CI).
// There is no fallback: the JSON test data holds placeholders, never the real account.
function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set. Add it to .env for local runs, or to the repository secrets on CI.`);
    }
    return value;
}
const ACCOUNT = {
    email: requireEnv('SHOP_EMAIL'),
    password: requireEnv('SHOP_PASSWORD'),
};
// JSON rows that use the placeholders switch to the real account; deliberately wrong/empty values stay as they are.
const EMAIL_PLACEHOLDER = '__SHOP_EMAIL__';
const PASSWORD_PLACEHOLDER = '__SHOP_PASSWORD__';
const resolveEmail = (email: string) => (email === EMAIL_PLACEHOLDER ? ACCOUNT.email : email);
const resolvePassword = (password: string) => (password === PASSWORD_PLACEHOLDER ? ACCOUNT.password : password);

const ValidLogins = LogInData.filter(data => data.shouldSucceed);
const InvalidLogins = LogInData.filter(data => !data.shouldSucceed);
const ValidProducts = ProductData.filter(product => product.shouldExist);
const InvalidProducts = ProductData.filter(product => !product.shouldExist);

async function logIn(page: Page, email: string, password: string) {
    const testLogInObject = new LogInPage(page);
    await testLogInObject.navigateTo(Urls.RauhShettyLogInRegisterUrl);
    await testLogInObject.login(email, password);
}


// Failed logins never touch the cart, so these run in every browser and in parallel.
test.describe('Test log in with invalid data', () => {
    for (const data of InvalidLogins) {
        test(`Log in with ${data.TestCaseID}`, { tag: TAGS.negativeLogin }, async ({ page }) => {
            await logIn(page, resolveEmail(data.email), resolvePassword(data.password));

            // Invalid login: the expected error is shown and the user stays on the login page
            await expect(page.getByText(data.expectedError)).toBeVisible();
        });
    }

    test.afterEach(async ({ page }, testInfo) => {
        await saveEvidence(page, testInfo, 'LogIn');
    });
});


test.describe('Shared account', () => {
    // In order, in one worker, even with fullyParallel: two tests must never log into the account at the same time.
    test.describe.configure({ mode: 'default' });
    test.skip(({ browserName }) => browserName !== SHARED_ACCOUNT_BROWSER, SKIP_REASON);

    test.describe('Test log in with valid data', () => {
        for (const data of ValidLogins) {
            test(`Log in with ${data.TestCaseID}`, { tag: TAGS.positiveLogin }, async ({ page }) => {
                await logIn(page, resolveEmail(data.email), resolvePassword(data.password));

                // Valid login: user is redirected to the shop dashboard
                await expect(page).toHaveURL(Urls.RauhShettyShopUrl);
            });
        }

        test.afterEach(async ({ page }, testInfo) => {
            await saveEvidence(page, testInfo, 'LogIn');
        });
    });

    // Every test below gets its own fresh page and logs in first, so it starts from a clean (empty) cart.
    test.describe('Cart flow', () => {
        test.beforeEach(async ({ page }) => {
            await logIn(page, ACCOUNT.email, ACCOUNT.password);
            await expect(page).toHaveURL(Urls.RauhShettyShopUrl);
        });

        test.afterEach(async ({ page }, testInfo) => {
            await saveEvidence(page, testInfo, 'Shop');
        });

        test('Products are visible in the shop', { tag: TAGS.smoke }, async ({ page }) => {
            const testShopPageObject = new ShopPage(page);
            for (const data of ValidProducts) {
                expect(await testShopPageObject.isProductListed(data.productName),
                    `"${data.productName}" should be listed in the shop`).toBe(true);
            }
        });

        test.describe('Test purchase product', () => {
            for (const data of ValidProducts) {
                test(`${data.TestCaseID}: purchase ${data.productName}`, { tag: TAGS.positiveCart }, async ({ page }) => {
                    const testShopPageObject = new ShopPage(page);
                    await testShopPageObject.addProductToCart(data.productName);
                });
            }
        });

        test.describe('Test select non-existent product', () => {
            for (const data of InvalidProducts) {
                test(`${data.TestCaseID}: select non-existent ${data.productName}`, { tag: TAGS.negativeCart }, async ({ page }) => {
                    const testShopPageObject = new ShopPage(page);

                    // Record any add-to-cart call, to prove nothing was sent to the server
                    const addToCartRequests: string[] = [];
                    page.on('request', request => {
                        if (request.url().includes('add-to-cart')) addToCartRequests.push(request.url());
                    });

                    // The product is not in the shop (checked after the product grid has loaded)
                    expect(await testShopPageObject.isProductListed(data.productName),
                        `"${data.productName}" should not be listed in the shop`).toBe(false);

                    // Trying to add it fails with a clear error instead of a click timeout
                    await expect(testShopPageObject.addProductToCart(data.productName))
                        .rejects.toThrow(`Product "${data.productName}" is not listed in the shop`);

                    // And no add-to-cart request reached the server
                    expect(addToCartRequests, 'no add-to-cart request should be sent').toHaveLength(0);
                });
            }
        });

        test.describe('Test delete product', () => {
            for (const data of ProductDelete) {
                test(`${data.TestCaseID}: delete ${data.productName}`, { tag: TAGS.positiveCart }, async ({ page }) => {
                    const testShopPageObject = new ShopPage(page);

                    // Precondition: login emptied the cart, so this test adds the product it is going to delete
                    await testShopPageObject.clickAddToCartButtonForSpecificProduct(data.productName);

                    // The product must really be deleted: "nothing to delete" is a failure, not a pass.
                    // deleteProductFromCart also checks that the rows and the Cart button number go down.
                    expect(await testShopPageObject.deleteProductFromCart(data.productName),
                        `"${data.productName}" should have been in the cart and deleted`).toBe(true);
                });
            }
        });
    });
});
