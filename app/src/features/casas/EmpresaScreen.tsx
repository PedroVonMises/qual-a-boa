import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import { useAccountEmail } from '@/data/auth';
import { formatCnpj } from '@/domain/casas';
import { formatPhone } from '@/features/dadosCadastrais';
import { Button, Text, TextField } from '@/ui';
import { CasasShell, CheckRow, Note, StepBar } from './parts';
import { companyErrors, type CompanyErrors, type CompanyField, type CompanyForm } from './format';
import { useCasasFlow } from './store';

/** /casas/vincular/empresa (2/3): CNPJ, razão social, responsável, WhatsApp. */
export function EmpresaScreen() {
  const router = useRouter();
  const email = useAccountEmail();
  const venue = useCasasFlow((s) => s.venue);
  const saved = useCasasFlow((s) => s.company);
  const setCompany = useCasasFlow((s) => s.setCompany);
  const [form, setForm] = useState<CompanyForm>(saved);
  const [errors, setErrors] = useState<CompanyErrors>({});

  if (!venue) return <Redirect href="/casas/vincular" />;

  const set = (patch: Partial<CompanyForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    // Clear a field's error as soon as it is fixed.
    if (Object.keys(errors).length) {
      const now = companyErrors(next);
      setErrors((prev) => Object.fromEntries(Object.keys(prev).filter((k) => now[k as CompanyField]).map((k) => [k, now[k as CompanyField]])));
    }
  };

  const onContinue = () => {
    const e = companyErrors(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setCompany({ ...form, cnpj: formatCnpj(form.cnpj), legalName: form.legalName.trim(), contactName: form.contactName.trim() });
    router.push('/casas/vincular/pagamento');
  };

  const venueName = venue.kind === 'catalog' ? venue.name : venue.proposed.name;

  return (
    <CasasShell
      title="Vincular casa"
      onBack={() => router.back()}
      testID="casas-empresa"
      footer={
        <>
          <Note tone="error" text={Object.keys(errors).length ? 'Confira os campos marcados.' : null} testID="casas-empresa-note" />
          <Button label="Continuar" fullWidth onPress={onContinue} testID="casas-empresa-continuar" />
        </>
      }>
      <StepBar step={2} total={3} label="Empresa" />
      <Text variant="headline" accessibilityRole="header">
        Dados da empresa
      </Text>
      <Text variant="bodySm" tone="textMuted">{`Usamos esses dados só para confirmar que a ${venueName} é sua.`}</Text>
      <TextField
        label="CNPJ"
        mono
        value={form.cnpj}
        onChangeText={(t) => set({ cnpj: formatCnpj(t) })}
        keyboardType="number-pad"
        maxLength={18}
        placeholder="00.000.000/0000-00"
        error={errors.cnpj}
        testID="casas-cnpj"
      />
      <TextField
        label="Razão social"
        value={form.legalName}
        onChangeText={(t) => set({ legalName: t })}
        maxLength={160}
        autoCapitalize="words"
        error={errors.legalName}
        testID="casas-razao"
      />
      <TextField
        label="Responsável"
        value={form.contactName}
        onChangeText={(t) => set({ contactName: t })}
        maxLength={120}
        autoComplete="name"
        autoCapitalize="words"
        error={errors.contactName}
        testID="casas-responsavel"
      />
      <TextField
        label="WhatsApp"
        mono
        value={form.whatsapp}
        onChangeText={(t) => set({ whatsapp: formatPhone(t) })}
        keyboardType="phone-pad"
        maxLength={15}
        placeholder="(27) 99999-0000"
        autoComplete="tel"
        textContentType="telephoneNumber"
        hint="Para falar com você sobre a verificação."
        error={errors.whatsapp}
        testID="casas-whatsapp"
      />
      {email ? (
        <TextField label="E-mail da conta" value={email} editable={false} hint="Os avisos da casa chegam aqui." testID="casas-email" />
      ) : null}
      <CheckRow
        label="Sou responsável por esta casa"
        checked={form.responsible}
        onToggle={() => set({ responsible: !form.responsible })}
        error={errors.responsible}
        testID="casas-responsavel-check"
      />
    </CasasShell>
  );
}
