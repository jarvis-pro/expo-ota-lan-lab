import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { LEVEL_META, MemberLevel, TXN_META, TxnType, useLedger } from '../store';

// ---------- 通用表单骨架 ----------

function Sheet({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <Pressable
            style={[styles.submit, submitDisabled && { opacity: 0.4 }]}
            disabled={submitDisabled}
            onPress={onSubmit}
          >
            <Text style={styles.submitText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ---------- 记一笔 ----------

export function AddTxnModal({
  visible,
  onClose,
  presetMemberId,
}: {
  visible: boolean;
  onClose: () => void;
  presetMemberId?: string;
}) {
  const { members, addTxn } = useLedger();
  const [type, setType] = useState<TxnType>('recharge');
  const [memberId, setMemberId] = useState<string | null>(presetMemberId ?? members[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const reset = () => {
    setType('recharge');
    setMemberId(presetMemberId ?? members[0]?.id ?? null);
    setAmount('');
    setNote('');
  };

  const amountNum = Number(amount);
  const valid = memberId != null && Number.isFinite(amountNum) && amountNum > 0;

  const submit = () => {
    if (!valid || memberId == null) return;
    addTxn({ memberId, type, amount: Math.round(amountNum * 100) / 100, note: note.trim() });
    reset();
    onClose();
  };

  return (
    <Sheet visible={visible} title="记一笔" onClose={onClose} onSubmit={submit} submitLabel="保存流水" submitDisabled={!valid}>
      <Field label="类型">
        <View style={styles.segRow}>
          {(Object.keys(TXN_META) as TxnType[]).map((t) => {
            const meta = TXN_META[t];
            const active = type === t;
            return (
              <Pressable
                key={t}
                style={[styles.seg, active && { backgroundColor: meta.soft, borderColor: meta.color }]}
                onPress={() => setType(t)}
              >
                <Text style={{ fontSize: 14 }}>{meta.icon}</Text>
                <Text style={[styles.segText, active && { color: meta.color, fontWeight: '700' }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="会员">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {members.map((m) => {
            const active = memberId === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.memberChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setMemberId(m.id)}
              >
                <Text style={[styles.memberChipText, active && { color: '#fff' }]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Field>

      <Field label="金额（元）">
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />
      </Field>

      <Field label="备注（可选）">
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="例如：手冲单品 / 月末储值活动"
          placeholderTextColor={colors.textFaint}
        />
      </Field>
    </Sheet>
  );
}

// ---------- 新增会员 ----------

export function AddMemberModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addMember } = useLedger();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState<MemberLevel>('normal');
  const [initRecharge, setInitRecharge] = useState('');

  const reset = () => {
    setName('');
    setPhone('');
    setLevel('normal');
    setInitRecharge('');
  };

  const valid = name.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    const init = Number(initRecharge);
    addMember({
      name: name.trim(),
      phone: phone.trim() || '未留手机',
      level,
      initRecharge: Number.isFinite(init) && init > 0 ? Math.round(init * 100) / 100 : 0,
    });
    reset();
    onClose();
  };

  return (
    <Sheet visible={visible} title="新增会员" onClose={onClose} onSubmit={submit} submitLabel="开卡" submitDisabled={!valid}>
      <Field label="姓名">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="会员姓名"
          placeholderTextColor={colors.textFaint}
        />
      </Field>

      <Field label="手机号（可选）">
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="用于到店核验"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
        />
      </Field>

      <Field label="会员等级">
        <View style={styles.segRow}>
          {(Object.keys(LEVEL_META) as MemberLevel[]).map((lv) => {
            const meta = LEVEL_META[lv];
            const active = level === lv;
            return (
              <Pressable
                key={lv}
                style={[styles.seg, active && { backgroundColor: meta.soft, borderColor: meta.color }]}
                onPress={() => setLevel(lv)}
              >
                <Text style={[styles.segText, active && { color: meta.color, fontWeight: '700' }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="开卡首充（元，可选）">
        <TextInput
          style={styles.input}
          value={initRecharge}
          onChangeText={setInitRecharge}
          placeholder="0.00"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
        />
      </Field>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,17,30,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontSize: font.title, fontWeight: '700', color: colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: font.caption, fontWeight: '600', color: colors.textSub, marginBottom: 8 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: font.body,
    color: colors.text,
  },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  segText: { fontSize: font.body, color: colors.textSub, fontWeight: '500' },
  memberChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  memberChipText: { fontSize: font.body, color: colors.textSub, fontWeight: '500' },
  submit: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
