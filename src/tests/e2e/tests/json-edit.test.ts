import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { userActions } from '@e2e/page-actions'
import { mongodbConfig } from '@e2e/config/mongodb'

let app: ElectronApplication
let window: Page

test.describe('JSON Cell Editing', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit JSON object field in MongoDB and apply without clone error', async () => {
    const actions = userActions(window)

    // Connect to MongoDB
    await actions.selectDatabaseType(mongodbConfig.type)
    await actions.fillConnectionDetails(mongodbConfig)
    await actions.connectToDatabase()

    // Wait for sidebar to show collections
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Open the orders collection (has embedded `items` array — JSON objects)
    await actions.openCollection('orders')

    // The first order has items: [{product_id: 1, name: "Wireless Mouse", ...}, ...]
    // Double-click the `items` cell in the first row to edit it
    const itemsCell = window.getByTestId('grid-cell-0-items')
    await expect(itemsCell).toBeVisible({ timeout: 10_000 })

    // Read the current value before editing
    const originalText = await itemsCell.innerText()
    expect(originalText).toContain('product_id')

    // Edit the JSON — toggle the first item's quantity to a unique value
    await itemsCell.dblclick()
    const editInput = window.getByTestId('grid-cell-edit-input')
    await expect(editInput).toBeVisible({ timeout: 5_000 })

    // Get current value, parse, modify with a unique value, stringify
    const currentJson = await editInput.inputValue()
    const parsed = JSON.parse(currentJson)
    const currentQty = parsed[0].quantity
    const newQty = currentQty === 42 ? 43 : 42
    parsed[0].quantity = newQty
    const newJson = JSON.stringify(parsed)

    await editInput.fill(newJson)
    await editInput.press('Enter')

    // The Apply button should appear (1 change)
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Click Apply — this is where the "An object could not be cloned" error
    // would occur if the fix is not in place (Vue reactive Proxy vs contextBridge)
    await applyBtn.click()

    // After successful apply, the button should disappear
    await expect(applyBtn).not.toBeVisible({ timeout: 30_000 })

    // Verify no error toast appeared
    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })

    // Verify the cell now shows the updated quantity
    const updatedText = await itemsCell.innerText()
    expect(updatedText).toContain(String(newQty))
  })

  test('edit string field in MongoDB and apply', async () => {
    const actions = userActions(window)

    // Connect to MongoDB
    await actions.selectDatabaseType(mongodbConfig.type)
    await actions.fillConnectionDetails(mongodbConfig)
    await actions.connectToDatabase()

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Open the customers collection (simple string fields)
    await actions.openCollection('customers')

    // Edit the `city` field of the first row with a unique value
    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    // Read current value and toggle to ensure it's always different
    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E City A' ? 'E2E City B' : 'E2E City A'

    await cityCell.dblclick()
    const editInput = window.getByTestId('grid-cell-edit-input')
    await expect(editInput).toBeVisible({ timeout: 5_000 })

    await editInput.fill(newCity)
    await editInput.press('Enter')

    // Apply changes
    await actions.applyChanges()

    // Verify the cell shows the new value
    const updatedText = await cityCell.innerText()
    expect(updatedText).toContain(newCity)
  })
})
