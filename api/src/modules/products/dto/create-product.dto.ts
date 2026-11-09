import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { ProductStatus } from '../../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

// Empty string -> undefined, so optional fields can be cleared cleanly
const trimOrUndefined = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value;

export class CreateProductDto {
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    sku: string;

    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name: string;

    // Generated from name if omitted
    @IsOptional()
    @Transform(trimOrUndefined)
    @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: 'slug must be lowercase letters, numbers and hyphens',
    })
    @MaxLength(220)
    slug?: string;

    @IsOptional()
    @Transform(trimOrUndefined)
    @IsString()
    @MaxLength(64)
    barcode?: string;

    @IsOptional()
    @Transform(trimOrUndefined)
    @IsString()
    @MaxLength(2000)
    description?: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(9_999_999_999.99) // fits Decimal(12, 2)
    price: number;

    @IsOptional()
    @IsEnum(ProductStatus)
    status?: ProductStatus;
}
