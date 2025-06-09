-- CreateTable
CREATE TABLE `Part` (
    `id` VARCHAR(191) NOT NULL,
    `name` TEXT NOT NULL,
    `brand` TEXT NOT NULL,
    `year` INTEGER NOT NULL,
    `condition` ENUM('BOA', 'MEDIA', 'RUIM') NOT NULL,
    `stock_address` TEXT NOT NULL,
    `dimensions` JSON NOT NULL,
    `weight` DECIMAL(5, 2) NULL,
    `compatibility` JSON NULL,
    `min_price` DECIMAL(10, 2) NULL,
    `suggested_price` DECIMAL(10, 2) NULL,
    `max_price` DECIMAL(10, 2) NULL,
    `part_description` TEXT NULL,
    `images` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
