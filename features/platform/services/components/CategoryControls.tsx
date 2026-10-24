'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field, TransitionPills } from '@/features/platform/lib/forms';
import { saveCategoryAction, setCategoryStatusAction, type CategoryRow } from '../actions/categories';

function CategoryFields({ category }: { category?: CategoryRow }) {
  return <>
    <Field id="category-name" label="Name" wide><Input id="category-name" name="name" defaultValue={category?.name} required maxLength={120} /></Field>
    <Field id="category-order" label="Order on the menu"><Input id="category-order" name="displayOrder" type="number" inputMode="numeric" min={0} max={999} defaultValue={category?.displayOrder ?? 0} className="font-mono" /></Field>
    <Field id="category-description" label="Description" wide><Textarea id="category-description" name="description" defaultValue={category?.description || ''} maxLength={500} /></Field>
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
    <span className="flex flex-wrap items-center gap-2">
      <DrawerForm trigger="Edit" title={`Edit ${category.name}`} action={(form) => saveCategoryAction(category.id, form)}>
        <CategoryFields category={category} />
      </DrawerForm>
      <TransitionPills label="Category status" current={category.status} options={[{ value: 'active', label: 'Show' }, { value: 'hidden', label: 'Hide' }]} run={(status) => setCategoryStatusAction(category.id, status)} />
    </span>
  );
}
