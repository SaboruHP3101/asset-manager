import 'package:flutter/material.dart';

import 'app_text.dart';

class RequirementCard {
  final String title;
  final IconData icon;
  final VoidCallback onTap;

  const RequirementCard({
    required this.title,
    required this.icon,
    required this.onTap,
  });
}

class RequirementGrid extends StatelessWidget {
  final List<RequirementCard> cards;
  final double cardHeight;
  final double gap;

  const RequirementGrid({
    super.key,
    required this.cards,
    this.cardHeight = 70,
    this.gap = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: gap,
        crossAxisSpacing: gap,
        childAspectRatio: 3 / 2, // Adjust if needed
      ),
      itemCount: cards.length,
      itemBuilder: (context, index) {
        return _RequirementCardTile(card: cards[index], height: cardHeight);
      },
    );
  }
}

class _RequirementCardTile extends StatelessWidget {
  final RequirementCard card;
  final double height;

  const _RequirementCardTile({required this.card, required this.height});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: InkWell(
          onTap: card.onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  card.icon,
                  size: 28,
                  color: Theme.of(context).primaryColor,
                ),
                const SizedBox(height: 16),
                AppText.fromTheme(
                  card.title,
                  context: context,
                  type: AppTextType.bodyS,
                  textAlign: TextAlign.left,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
