part of 'purchase_request_form.dart';

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.complete, required this.total});
  final int complete;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Hoàn thiện đề nghị của bạn',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          '$complete/$total hạng mục đã đủ thông tin',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : complete / total,
            color: Theme.of(context).colorScheme.primary,
            backgroundColor: Theme.of(context).colorScheme.onPrimaryContainer
                .withValues(alpha: 0.12),
            minHeight: 7,
          ),
        ),
      ],
    ),
  );
}

class _InformationCard extends StatelessWidget {
  const _InformationCard({
    required this.date,
    required this.purpose,
    required this.note,
    required this.onPickDate,
    required this.onChanged,
  });
  final DateTime date;
  final TextEditingController purpose;
  final TextEditingController note;
  final VoidCallback onPickDate;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Title(
            icon: Icons.description_outlined,
            text: 'Thông tin đề nghị',
          ),
          const SizedBox(height: 14),
          InkWell(
            onTap: onPickDate,
            borderRadius: BorderRadius.circular(14),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Ngày cần tài sản',
                suffixIcon: Icon(Icons.calendar_month_outlined),
              ),
              child: Text(formatDisplayDate(date)),
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: purpose,
            maxLines: 2,
            decoration: textareaDecoration(
              context,
              const InputDecoration(
                labelText: 'Mục đích sử dụng *',
                hintText: 'Ví dụ: Trang bị cho nhân viên mới',
                prefixIcon: Icon(Icons.flag_outlined),
              ),
            ),
            onChanged: (_) => onChanged(),
            validator: _required,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: note,
            maxLines: 2,
            decoration: textareaDecoration(
              context,
              const InputDecoration(
                labelText: 'Ghi chú',
                prefixIcon: Icon(Icons.notes_outlined),
              ),
            ),
            onChanged: (_) => onChanged(),
          ),
        ],
      ),
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.itemCount,
    required this.quantity,
    required this.date,
  });
  final int itemCount;
  final int quantity;
  final String date;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Title(icon: Icons.summarize_outlined, text: 'Tóm tắt'),
          const SizedBox(height: 10),
          Text('$itemCount hạng mục · Tổng số lượng $quantity'),
          Text('Ngày cần: $date'),
        ],
      ),
    ),
  );
}

class _ReviewSheet extends StatelessWidget {
  const _ReviewSheet({
    required this.date,
    required this.purpose,
    required this.items,
    required this.categoryName,
  });
  final String date;
  final String purpose;
  final List<_ItemControllers> items;
  final String? Function(String?) categoryName;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kiểm tra trước khi gửi',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 6),
          const Text(
            'Sau khi gửi, nội dung sẽ bị khóa cho đến khi được trả về.',
          ),
          const SizedBox(height: 16),
          Text('Ngày cần: $date'),
          Text('Mục đích: $purpose'),
          const Divider(height: 28),
          for (var index = 0; index < items.length; index++)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(child: Text('${index + 1}')),
              title: Text(items[index].name.text.trim()),
              subtitle: Text(
                '${categoryName(items[index].rootId)} › '
                '${categoryName(items[index].categoryId)}'
                '${items[index].requiresCustomType ? ' · ${items[index].customTypeDescription.text.trim()}' : ''}',
              ),
              trailing: Text('×${items[index].quantity.text}'),
            ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: const Icon(Icons.send_outlined),
              label: const Text('Xác nhận gửi'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại chỉnh sửa'),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.saving,
    required this.deleting,
    required this.onDraft,
    required this.onSubmit,
  });
  final bool saving;
  final bool deleting;
  final VoidCallback onDraft;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => Material(
    elevation: 12,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: saving || deleting ? null : onDraft,
                child: const Text('Lưu nháp'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: saving || deleting ? null : onSubmit,
                icon: saving
                    ? const ButtonSpinner()
                    : const Icon(Icons.fact_check_outlined),
                label: Text(saving ? 'Đang lưu...' : 'Kiểm tra & gửi'),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Title extends StatelessWidget {
  const _Title({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 8),
      Text(
        text,
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ],
  );
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const LinearProgressIndicator(),
      const SizedBox(height: 16),
      for (final height in [120.0, 220.0, 120.0]) ...[
        Container(
          height: height,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        const SizedBox(height: 14),
      ],
    ],
  );
}

class _MessageState extends StatelessWidget {
  const _MessageState({
    required this.icon,
    required this.title,
    required this.action,
  });
  final IconData icon;
  final String title;
  final VoidCallback action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: action,
            icon: const Icon(Icons.refresh),
            label: const Text('Tải lại'),
          ),
        ],
      ),
    ),
  );
}

String? _required(String? value) => value == null || value.trim().isEmpty
    ? 'Vui lòng nhập thông tin này.'
    : null;

String _isoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
