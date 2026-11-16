import fonts from '../data/documentFonts.json';
export const DOCUMENT_FONT_CSS = [
 ["Inter",400,"normal",fonts.InterRegular], ["Inter",700,"normal",fonts.InterBold], ["Cinzel",700,"normal",fonts.CinzelBold], ["Playfair Display",400,"normal",fonts.PlayfairRegular], ["Playfair Display",400,"italic",fonts.PlayfairItalic]
].map(([family,weight,style,data]) => '@font-face{font-family:"'+family+'";font-weight:'+weight+';font-style:'+style+';src:url(data:font/ttf;base64,'+data+') format("truetype");}').join('\n');
