import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { IsNoInvisibleChars } from "../../common/validators/no-invisible-chars.validator";

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  @IsNoInvisibleChars()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @IsNoInvisibleChars()
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsNoInvisibleChars()
  password!: string;
}
