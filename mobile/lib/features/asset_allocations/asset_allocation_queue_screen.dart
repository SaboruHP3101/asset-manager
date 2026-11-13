import 'package:flutter/material.dart';

import '../../core/theme/textarea_decoration.dart';
import '../../core/utils/department_labels.dart';
import '../../core/widgets/button_spinner.dart';
import '../../core/widgets/retry_message.dart';
import '../../core/widgets/status_chip.dart';
import 'asset_allocation_models.dart';
import 'asset_allocations_repository.dart';

part 'asset_allocation_group_screen.dart';
part 'asset_allocation_form_screen.dart';

class AssetAllocationQueueScreen extends StatefulWidget {
  const AssetAllocationQueueScreen({super.key, this.repository});

  final AssetAllocationsRepository? repository;

  @override
  State<AssetAllocationQueueScreen> createState() =>
      _AssetAllocationQueueScreenState();
}

class _AssetAllocationQueueScreenState
    extends State<AssetAllocationQueueScreen> {
  late final AssetAllocationsRepository _repository;
  List<AssetAllocationGroup>? _groups;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? AssetAllocationsRepository();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _groups = null;
      _error = null;
    });
    try {
      final tasks = await _repository.findQueue();
      if (mounted) setState(() => _groups = groupAllocationTasks(tasks));
    } catch (error) {
      if (mounted) setState(() => _error = assetAllocationApiError(error));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cấp phát tài sản'), centerTitle: true),
    body: _error != null
        ? RetryMessage(message: _error!, onRetry: _load)
        : _groups == null
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _load,
            child: _groups!.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 140),
                      Icon(Icons.assignment_turned_in_outlined, size: 56),
                      SizedBox(height: 12),
                      Text(
                        'Không có đề nghị cần cấp phát.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _groups!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, index) => _GroupCard(
                      group: _groups![index],
                      onTap: () async {
                        final changed = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => _AllocationGroupScreen(
                              group: _groups![index],
                              repository: _repository,
                            ),
                          ),
                        );
                        if (changed == true && mounted) await _load();
                      },
                    ),
                  ),
          ),
  );
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group, required this.onTap});

  final AssetAllocationGroup group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    group.requestCode,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(value: group.progress),
            const SizedBox(height: 8),
            Text(
              '${group.allocatedAssets}/${group.totalAssets} tài sản đã cấp phát'
              ' · ${group.tasks.length} việc cần xử lý',
            ),
          ],
        ),
      ),
    ),
  );
}
