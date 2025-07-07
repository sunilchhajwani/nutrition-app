import re
import pandas as pd
from markdown import markdown

def structure_output(raw_output):
    """
    Processes a specific format of raw API output to extract nutrient information,
    diet analysis, and personalized recommendations, structuring them into a
    clean markdown report.
    Args:
        raw_output (str): The raw text output from the API in the new format.
    Returns:
        str: A markdown formatted string containing the structured dietary analysis.
    """
    # Define nutrients we are looking for. The order matters for parsing the table.
    nutrients_order = ['Sodium', 'Calories', 'Protein', 'Carbohydrates', 'Fat', 'Fiber']        
    table_data = {}        
    # --- Parse Summary Table ---
    # The table is in a pipe-delimited format like:
    # | Nutrient | Amount | Unit |
    # |---
    # | Sodium | 32 | 0 |  <- This part is tricky, sometimes it's just numbers
    # | Calories | 29 | 0 |
    # | Protein | 8 | g |
    # ... and then the analysis starts.
    # Extract the nutrient lines from the table part
    # We're looking for lines that start with a nutrient name and have pipes
    nutrient_lines = re.findall(r"\| (.*?)\s*\| (.*?) \| (.*?)(?: \||$)", raw_output)
    # The above regex might capture the analysis lines too. Let's refine by checking nutrient names.
    parsed_nutrients = {}
    for item in nutrient_lines:
        nutrient_name = item[0].strip()
        amount = item[1].strip()
        unit = item[2].strip()                
        # Only consider lines that match our target nutrients, and ensure it's not the header/separator
        if nutrient_name in nutrients_order and not unit.startswith('-') and not amount.startswith('-'):
            parsed_nutrients[nutrient_name] = (amount, unit)
    # Populate table_data, filling with fallback if not found
    for nutrient in nutrients_order:
        if nutrient in parsed_nutrients:
            table_data[nutrient] = parsed_nutrients[nutrient]
        else:
            # Fallback: Try to find the nutrient name followed by a number and unit anywhere
            pattern = rf"{nutrient.lower()}\s*[:=]?\s*([\d.]+)\s*(\w+)"
            match = re.search(pattern, raw_output, re.IGNORECASE)
            if match:
                table_data[nutrient] = match.groups()
            else:
                # Last resort fallback
                fallback_pattern = rf"{nutrient.lower()}\D*?(\d+)\s*(\w+)"
                match = re.search(fallback_pattern, raw_output, re.IGNORECASE)
                table_data[nutrient] = match.groups() if match else ('Unknown', '')
    df = pd.DataFrame.from_dict(table_data, orient='index', columns=['Amount', 'Unit'])
    df.index.name = 'Nutrient'
    # --- Extract Diet Analysis ---
    analysis_points = []
    # Look for sentences that describe the meal or a nutrient's implication.
    # These often start with '*' or describe a deficiency/excess.
    # We'll try to capture sentences that appear after the "Diet Analysis" header
    # and before "Personalized Recommendations".
    analysis_section_match = re.search(r"## Diet Analysis(?:.*?)\#(.*?)\#\#\# Personalized Recommendations", raw_output, re.IGNORECASE | re.DOTALL)        
    if analysis_section_match:
        analysis_text = analysis_section_match.group(1)
        # Split by sentences, looking for common sentence terminators and ignoring short ones like "e -"
        analysis_sentences = re.split(r'(?<=[.?])\s+(?[eE]\s*-)', analysis_text)                
        for sentence in analysis_sentences:
            clean_sentence = sentence.strip()
            # Filter out empty strings, separator lines, or lines that are clearly headers/titles
            if clean_sentence and not clean_sentence.startswith('#') and not clean_sentence.startswith('-') and not clean_sentence.startswith('|') and len(clean_sentence) > 10: # Heuristic to avoid short noise
                # Remove common markdown formatting that might be in the text
                clean_sentence = re.sub(r'\*\*', '', clean_sentence)
                analysis_points.append(clean_sentence)
    # --- Extract Personalized Recommendations ---
    recommendations_by_nutrient = {nutrient: [] for nutrient in nutrients_order}        
    # Find the block of recommendations
    recs_block_match = re.search(r"\#\#\# Personalized Recommendations(.*?)\Z", raw_output, re.IGNORECASE | re.DOTALL)
    if recs_block_match:
        recommendation_text = recs_block_match.group(1)
        # Split by the #### Nutrient Name pattern or general sentence structure if that fails
        # The format is like: #### Sodium 1. No specific recommendations...                
        # Try to split based on the #### Nutrient Name pattern
        rec_items = re.split(r'\#\#\#\s*(.*?)\s+(?:\d+\.\s*|$)', recommendation_text)                
        current_nutrient = None
        for item in rec_items:
            item = item.strip()
            if not item: continue
            # Check if this item is a nutrient name followed by a number and then the recommendation text
            nutrient_match = re.match(r"(\w+)\s+(\d+\.\s*)(.*)", item, re.IGNORECASE)                        
            if nutrient_match:
                current_nutrient = nutrient_match.group(1)
                recommendation_text_part = nutrient_match.group(2) + nutrient_match.group(3)                                
                # Ensure the identified nutrient is one we are tracking
                if current_nutrient in nutrients_order:
                    recommendations_by_nutrient[current_nutrient].append(recommendation_text_part.strip())
            elif current_nutrient and current_nutrient in nutrients_order:
                # If it's not a new nutrient header, assume it's a continuation of the previous recommendation
                # or a standalone recommendation not fitting the strict pattern.
                # For this specific input, the format is mostly '#### Nutrient Name 1. Recommendation...'
                # so this part might be less utilized.
                pass # We assume each recommendation is self-contained with the nutrient name
    # --- Format as Markdown ---
    markdown_output = "# Dietary Analysis Report\n\n"
    markdown_output += "## Summary Table\n"
    markdown_output += df.to_markdown(index=True) + "\n\n"
    markdown_output += "## Diet Analysis\n"
    if analysis_points:
        for point in analysis_points:
            markdown_output += f"- {point}\n"
    else:
        markdown_output += "No specific diet analysis points extracted.\n"
    markdown_output += "\n## Personalized Recommendations\n"
    for nutrient in nutrients_order:
        markdown_output += f"### {nutrient}\n"
        nutrient_recs = recommendations_by_nutrient.get(nutrient, [])
        if nutrient_recs:
            for i, rec in enumerate(nutrient_recs, 1):
                markdown_output += f"{i}. {rec}\n"
        else:
            # Fallback message if no specific recommendations found for a nutrient
            markdown_output += f"1. No specific recommendations found for {nutrient}. Please consult a dietician for personalized advice.\n"
    return markdown_output