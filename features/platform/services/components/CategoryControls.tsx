'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field } from '@/features/platform/lib/forms';
import { RowMenu, statusItems } from '@/features/platform/records/lib/controls';
import { saveCategoryAction, setCategoryStatusAction, type CategoryRow } from '../actions/categories';

function CategoryFields({ category }: { category?: CategoryRow }) {
  return <>
    <Field id="category-name" label="Name" wide><Input id="category-name" name="name" defaultValue={category?.name} required maxLength={120} className="h-9 rounded-[6px]" /></Field>
    <Field id="category-order" label="Order on the menu"><Input id="category-order" name="displayOrder" type="number" inputMode="numeric" min={0} max={999} defaultValue={category?.displayOrder ?? 0} className="h-9 rounded-[6px] font-mono" /></Field>
    <Field id="category-description" label="Description" wide><Textarea id="category-description" name="description" defaultValue={category?.description || ''} maxLength={500} className="rounded-[6px]" /></Field>
  </>;
}

export function NewCategoryButton() {
  return (
    <DrawerForm trigger="New category" triggerVariant="primary" title="New category" action={(form) => saveCategoryAction(null, form)}>
      <CategoryFields />
    </DrawerForm>
  );
}

export function CategoryActions({ category }: { category: CategoryRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      <DrawerForm trigger="Edit" title={`Edit ${category.name}`} action={(form) => saveCategoryAction(category.id, form)}>
        <CategoryFields category={category} />
      </DrawerForm>
      <RowMenu label={`More actions for ${category.name}`} title={category.name} items={statusItems(category.status, [{ value: 'active', label: 'Show on the menu' }, { value: 'hidden', label: 'Hide from the menu' }], (status) => setCategoryStatusAction(category.id, status))} />
    </span>
  );
}
