"use client";

import { useState } from "react";

import { saveRecipeAction } from "@/app/dashboard/operations/actions";
import { OperationForm } from "./operation-form";

type Option = { id: string; name: string };

export function RecipeForm({
  inventoryItems,
  menuItems,
}: {
  inventoryItems: Option[];
  menuItems: Option[];
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("");

  return (
    <OperationForm action={saveRecipeAction} className="mt-6" submitLabel="Save recipe">
      <label>
        Sale item
        <select name="menuItemId" required>
          <option value="">Select sale item</option>
          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Inventory ingredient
        <select required value={inventoryItemId} onChange={(event) => setInventoryItemId(event.target.value)}>
          <option value="">Select ingredient</option>
          {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>
        Quantity used per sale
        <input min="0.001" required step="0.001" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(inventoryItemId && quantity ? [{ inventoryItemId, quantity }] : [])}
      />
    </OperationForm>
  );
}
